import { app } from '../lexicons/index.js'
import { type AppContext } from '../util/config.js'
import * as xrpc from '@atproto/xrpc-server'

export default function (server: xrpc.Server, ctx: AppContext) {
  server.method(app.bsky.feed.sendInteractions.$nsid, async ({ input, req }): Promise<app.bsky.feed.sendInteractions.$Output> => {
    const hInput = input as app.bsky.feed.sendInteractions.$Input
    ctx.logger.info(`'sendInteractions called with params:'${JSON.stringify(hInput)}`)

    return {
      encoding: 'application/json',
      body: {},
    }
  })
}
