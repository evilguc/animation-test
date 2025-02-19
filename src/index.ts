import { Router } from "itty-router";
import { handleSessionRequest } from "./app";
import { handleServiceApiRequest } from "./service-api";
import { AnimationSessionDO } from "./app/session";

const router = Router();

router.all("/session/*", handleSessionRequest);

router.all("/service-api/*", (request, env) => {
  const newRequest = new Request(request.url.replace("/service-api", ""), request);
  return handleServiceApiRequest(newRequest, env);
});

export default router;

export { AnimationSessionDO };
