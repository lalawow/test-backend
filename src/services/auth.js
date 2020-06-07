import * as jwt from "jsonwebtoken";
import axios from "axios";
import { pick } from "lodash";

import API from "../api/auth";
import { SessionModel, PasswordModel, UserModel } from "../models";
import { isObjectId, pwdEncrypt } from "../lib/utils";
import {
  JWT_KEY,
  JWT_EXPIRES,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
} from "../config";

export class Service extends API {
  /**
   * Ability to inject some middlewares
   *
   * @param {string} operation name of operation
   * @returns {function[]} middlewares
   */
  middlewares(operation) {
    const load = async (ctx, next) => {
      let { id } = ctx.params;
      if (id) {
        ctx.state.friendship = await FriendshipModel.get(id);
        if (!ctx.state.friendship) {
          throw ctx.throw(404, `friendship ${id} not found.`);
        }
      }
      await next();
    };
    return [load];
  }

  /**
   * Get who is following user {userId}
   *
   * @param {GetFriendshipsToIdRequest} req getFriendshipsToId request
   * @param {import("koa").Context} ctx koa context
   * @returns {GetFriendshipsToIdResponse} Expected response to a valid request
   */
  async reqGithub(req, ctx) {
    const scope = ["user"];
    const stateStr = new Date().valueOf();

    const path = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=${scope}&state=${stateStr}`;

    ctx.redirect(path);
  }

  /**
   * Get who user {userId} is following
   *
   * @param {GetFriendshipsFromIdRequest} req getFriendshipsFromId request
   * @param {import("koa").Context} ctx koa context
   * @returns {GetFriendshipsFromIdResponse} Expected response to a valid request
   */
  async reqGithubCallback(req, ctx) {
    const { code } = ctx.query;

    const path = "https://github.com/login/oauth/access_token";
    const params = {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code: code,
    };
    const githubFeedback = await axios({
      url: path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: JSON.stringify(params),
    }).then(res => res.data);

    if (!/^access_token/.test(githubFeedback))
      throw ctx.throw(404, "wrong code!");

    const access_token = githubFeedback.split("&")[0].split("=")[1];
    const userUrl = `https://api.github.com/user?access_token=${access_token}`;
    const githubUser = await axios.get(userUrl);
    const githubLogin = githubUser.data.login;

    const userDoc = await UserModel.findOne({ github: githubLogin });
    if (!userDoc) throw ctx.throw(404, `User didn't sign up.`);

    const sessionPayload = {
      user: userDoc.id,
      type: "github",
    };

    await SessionModel.create(sessionPayload);

    return { body: { token: genToken(sessionPayload), user: userDoc } };
  }

  /**
   * Create login session
   *
   * @param {LoginRequest} req login request
   * @param {import("koa").Context} ctx koa context
   * @returns {LoginResponse} login session created
   */
  async login(req, ctx) {
    const { user, password } = req.body;

    if (!user || !password) throw ctx.throw(404, `user or password not found.`);

    const userDoc = await UserModel.findOne({ name: user });
    if (!userDoc) throw ctx.throw(404, `username or password is wrong.`);

    const checkPass = await PasswordModel.find({
      user: userDoc.id,
      password: pwdEncrypt(password),
    });
    if (!checkPass) throw ctx.throw(404, `username or password is wrong.`);

    const sessionPayload = {
      user: userDoc.id,
      type: "password",
    };

    await SessionModel.create(sessionPayload);

    return { body: { token: genToken(sessionPayload), user: userDoc } };
  }

  /**
   * Logout
   *
   * @param {LogoutRequest} req logout request
   * @param {import("koa").Context} ctx koa context
   */
  async logout(req, ctx) {}
}

const genToken = payload =>
  jwt.sign(payload, JWT_KEY, { expiresIn: JWT_EXPIRES });

const service = new Service();
export default service;