const { ipcMain, Notification } = require("electron");

function registerNotifications() {
  ipcMain.handle(
    "show-notification",
    (_event, { title, body, silent = false }) => {
      try {
        if (!Notification.isSupported()) return;
        const notification = new Notification({
          title: String(title),
          body: String(body),
          silent,
        });
        notification.show();
      } catch {}
    },
  );
}

module.exports = { registerNotifications };
