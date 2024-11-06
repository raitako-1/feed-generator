import {
  getJetstreamOpsByType,
  isJetstreamCommit,
  JetstreamEvent,
  JetstreamFirehoseSubscriptionBase,
} from './util/jetstream-subscription'
  
export class JetstreamFirehoseSubscription extends JetstreamFirehoseSubscriptionBase {
  async handleEvent(evt: JetstreamEvent) {
    if (!isJetstreamCommit(evt)) return

    const ops = getJetstreamOpsByType(evt)

    if (!ops || !ops.posts?.length) return

    // This logs the text of every post off the firehose.
    // Just for fun :)
    // Delete before actually using
    for (const post of ops.posts) {
      console.log(post.commit.record.text)
    }
    
    const postsToCreate = ops.posts
      .filter((create) => {
        // only alf-related posts
        return create.commit.record.text.toLowerCase().includes('alf')
      })
      .map((create) => {
        // map alf-related posts to a db row
        return {
          uri: `at://${create.did}/${create.commit.collection}/${create.commit.rkey}`,
          cid: create.commit.cid,
          indexedAt: new Date().toISOString(),
        }
      })

    if (postsToCreate.length > 0) {
      // handle post however here
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}
