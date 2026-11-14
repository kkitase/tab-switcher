// ツールバーのアイコンを押したときの説明。いまのショートカットと使い方だけを出す
const t = (key) => chrome.i18n.getMessage(key);

document.documentElement.lang = chrome.i18n.getUILanguage();
document.getElementById("shortcut-label").textContent = t("popupShortcutLabel");
document.getElementById("usage").textContent = t("popupUsage");

const changeButton = document.getElementById("change");
changeButton.textContent = t("popupChangeShortcut");
changeButton.addEventListener("click", async () => {
  await chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  window.close();
});

// ほかの拡張機能と重なって割り当てられなかった場合は空になるので、未設定と案内する
const commands = await chrome.commands.getAll();
const shortcut = commands.find((command) => command.name === "switch")?.shortcut ?? "";
const shortcutEl = document.getElementById("shortcut");
if (shortcut) {
  shortcutEl.textContent = shortcut;
} else {
  shortcutEl.textContent = t("popupNotSet");
  shortcutEl.classList.add("not-set");
  const help = document.getElementById("not-set-help");
  help.textContent = t("popupNotSetHelp");
  help.hidden = false;
}
