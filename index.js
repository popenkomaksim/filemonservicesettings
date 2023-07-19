require("dotenv").config();
const fs = require("fs");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const express = require("express");
const mustacheExpress = require("mustache-express");
const bodyParser = require("body-parser");
const replace = require("replace-in-file");

const readFile = util.promisify(fs.readFile);
const copyFile = util.promisify(fs.copyFile);

const app = express();
const port = 3000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeid(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

const fileMonServiceGetter = (text) => {
  var regex = new RegExp(
    "^ExecStart=/usr/bin/unbuffer /home/pi/FileMonService 9000 (.*)$",
    "m"
  );
  var match = regex.exec(text);
  if (match) return match[1].replace(" /home/pi/usb_share", "");
  else return null;
};

const getFilemonserviceServiceTenetaPassword = async () => {
  const filemonserviceServiceFile = await readFile(
    process.env.FILEMONSERVICE_SERVICE_FILE_PATH,
    "utf8"
  );
  return fileMonServiceGetter(filemonserviceServiceFile);
};

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "mustache");
app.engine("mustache", mustacheExpress());

app.use("/", express.static("static"));
app.get("/", async function (request, res) {
  const password = await getFilemonserviceServiceTenetaPassword();
  console.log("password= ", password);
  res.render("index", {
    password,
  });
});

app.get("/pass", async (req, res) => {
  res.send(await getFilemonserviceServiceTenetaPassword());
});

app.post("/", async (req, res) => {
  const password = req.body.password;
  await copyFile(
    "./filemonservice.service.template",
    process.env.FILEMONSERVICE_SERVICE_FILE_PATH
  );
  await replace({
    files: process.env.FILEMONSERVICE_SERVICE_FILE_PATH,
    from: /%%password%%/g,
    to: password,
  });

  try {
    const { stdout, stderr } = await exec(
      "sudo systemctl daemon-reload && sudo systemctl restart filemonservice"
    );
    console.log("stdout:", stdout);
    console.log("stderr:", stderr);
  } catch (e) {
    console.error(e);
    const password = await getFilemonserviceServiceTenetaPassword();
    console.log("password= ", password);
    return res.render("index", {
      password,
      message: `Помилка. Спробуйте знову.${e.message}`,
    });
  }

  const passwordAfterSave = await getFilemonserviceServiceTenetaPassword();
  console.log("passwordAfterSave= ", passwordAfterSave);
  return res.render("index", {
    password: passwordAfterSave,
    message: "Збережено",
  });
});

app.get("/logs", async (req, res) => {
  try {
    const [filemonserviceLogs, unmountmountLogs, turnkeyLogs, filemonservicesettingsLogs] = await Promise.all([
      await exec(
        // "journalctl -n 1000 -u filemonservice.service"
        "yes 'text' | head -n 1000"
      ),
      await exec(
        // "journalctl -n 1000 -u unmountmount.service"
        "yes 'text' | head -n 1000"
      ),
      await exec(
        // "journalctl -n 1000 -u turnkey.service"
        "yes 'text' | head -n 1000"
      ),
      await exec(
        // "journalctl -n 1000 -u filemonservicesettings.service"
        "yes 'text' | head -n 1000"
      )
    ]);
    
    console.log("filemonserviceLogs.stdout.length:", filemonserviceLogs.stdout.length);
    console.log("filemonserviceLogs.stderr.length:", filemonserviceLogs.stderr.length);
    
    console.log("unmountmountLogs.stdout.length:", unmountmountLogs.stdout.length);
    console.log("unmountmountLogs.stderr.length:", unmountmountLogs.stderr.length);
    
    console.log("turnkeyLogs.stdout.length:", turnkeyLogs.stdout.length);
    console.log("turnkeyLogs.stderr.length:", turnkeyLogs.stderr.length);
    
    console.log("filemonservicesettingsLogs.stdout.length:", filemonservicesettingsLogs.stdout.length);
    console.log("filemonservicesettingsLogs.stderr.length:", filemonservicesettingsLogs.stderr.length);
    
    return res.render("logs", {
      filemonserviceLogs, unmountmountLogs, turnkeyLogs, filemonservicesettingsLogs
    });
  } catch (e) {
    console.error(e);
    const password = await getFilemonserviceServiceTenetaPassword();
    console.log(password);
    return res.render("logs", {
      error: e,
      message: "a"
    });
  }
});

app.post("/forgetwifi", async (req, res) => {
  await copyFile(
    "/etc/wpa_supplicant/wpa_supplicant.conf",
    `/etc/wpa_supplicant/wpa_supplicant.conf.backup.${makeid(5)}`
  );

  await copyFile(
    "./wpa_supplicant.conf.template",
    "/etc/wpa_supplicant/wpa_supplicant.conf"
  );

  try {
    const { stdout, stderr } = await exec(
      "wpa_cli -i wlan0 reconfigure && sudo service networking restart && sudo systemctl restart turnkey.service"
    );
    console.log("stdout:", stdout);
    console.log("stderr:", stderr);
  } catch (e) {
    console.error(e);
    const password = await getFilemonserviceServiceTenetaPassword();
    console.log("password= ", password);
    return res.render("index", {
      password,
      message: `Помилка. Спробуйте знову.${e.message}`,
    });
  }

  const passwordAfterSave = await getFilemonserviceServiceTenetaPassword();
  console.log("passwordAfterSave= ", passwordAfterSave);
  return res.render("index", {
    password: passwordAfterSave,
    message: "WIFI мережі забуто. Зараз rasberrypi перезавантажиться",
  });
});

(async () => {
  try {
    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
  } catch (e) {
    console.error(e);
  }
})();
