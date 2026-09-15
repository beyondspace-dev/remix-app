import assert from "node:assert/strict";
import test from "node:test";

import { SubscriptionScope } from "../src/subscriptions.ts";

test("lifecycle timers stop when their subscription scope is aborted", async () => {
  const scope = new SubscriptionScope();
  let calls = 0;

  scope.lifecycle.setTimeout(() => calls++, 0);
  scope.lifecycle.setInterval(() => calls++, 1);
  scope.abort();

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(scope.lifecycle.signal.aborted, true);
  assert.equal(calls, 0);
  await scope.clear();
});
