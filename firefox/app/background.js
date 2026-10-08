// Opening our bundled reader page does not require the "tabs" permission.
browser.action.onClicked.addListener(() => {
  void browser.tabs.create({ url: browser.runtime.getURL('reader.html') });
});
