// import { decodeJwtToken } from "../lib/utils";
// import { UserModel } from "../models";

export default function () {
  return async (ctx, next) => {
    const authorization = ctx.header.authorization;
    if (!authorization) return next();

    // const accessToken = authorization.split(" ")[1];
    // const accessTokenInfo = decodeJwtToken(accessToken);
    // const userId = accessTokenInfo.user;
    // const user = await UserModel.get(userId);

    // Already get the user from the JWT token
    // TODO Authorization content

    return next();
  };
}
