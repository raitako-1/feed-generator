import { OperationsByType } from './util/subscription'
import { Database } from './db'

export const handleEvent = async (ops: OperationsByType, db: Database): Promise<void> => {
  // This logs the text of every post off the firehose.
  // Just for fun :)
  // Delete before actually using
  for (const post of ops.posts.creates) {
    console.log(post.record.text)
  }

  const postsToDelete = ops.posts.deletes.map((del) => del.uri)
  const postsToCreate = ops.posts.creates
    .filter((create) => {
      // only alf-related posts
      return create.record.text.toLowerCase().includes('alf')
    })
    .map((create) => {
      // map alf-related posts to a db row
      return {
        uri: create.uri,
        cid: create.cid,
        indexedAt: new Date().toISOString(),
      }
    })

  if (postsToDelete.length > 0) {
    await db
      .deleteFrom('post')
      .where('uri', 'in', postsToDelete)
      .execute()
  }
  if (postsToCreate.length > 0) {
    await db
      .insertInto('post')
      .values(postsToCreate)
      .onConflict((oc) => oc.doNothing())
      .execute()
  }
}
