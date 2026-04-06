/* eslint-disable no-restricted-globals */
self.addEventListener("push", (event) => {
  let payload = { title: "Bus update", body: "" };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    payload.body = event.data?.text() ?? "";
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag ?? "bus",
    })
  );
});
