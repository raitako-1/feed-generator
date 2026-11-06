import { app } from '../lexicons/index.js'
import { type AppContext } from '../util/config.js'
import * as xrpc from '@atproto/xrpc-server'

export default function (server: xrpc.Server, ctx: AppContext) {
  server.method(app.bsky.feed.sendInteractions.$nsid, async (hCtx: any): Promise<app.bsky.feed.sendInteractions.$Output> => {
    ctx.logger.info(`'sendInteractions called with params:'${JSON.stringify(hCtx.params)}`)

    return {
      encoding: 'application/json',
      body: {},
    }
  })
}
