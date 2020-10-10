const Firestore = require('@google-cloud/firestore');

const PROJECTID = process.env.PROJECTID;
const COLLECTION_NAME = process.env.COLLECTION_NAME;

/**
 * Background Cloud Function to be triggered by PubSub.
 * https://cloud.google.com/functions/docs/writing/background
 *
 * The received data payload is assumed to be a commercetools order.
 *
 * The function validates the payload and writes valid documents to
 * a GCP Cloud Firestore collection.
 *
 * @param {object} message The Cloud Pub/Sub Message object.
 * @param {object} context The event metadata.
 * @param {function} callback A callback to signal completion of the function's execution.
 */
exports.orderArchive = async (message, context, callback) => {
  const { eventId } = context || {};
  try {
    // extract the order from the pubsub message
    const { data } = message || {};
    const order = JSON.parse(Buffer.from(data, 'base64').toString());

    // validate the order; noop if its invalid
    if (order) { // TODO: use joi here

      const firestore = new Firestore({ projectId: PROJECTID });
      const result = await firestore
        .collection(COLLECTION_NAME)
        .add(order);

      callback(null, 'Success');
      console.log({ message: 'orderArchive success', eventId });
      firestore.terminate();

    } else {
      callback(null, 'Order Invalid'); // function successful but payload was bad
      console.log({ message: 'orderArchive data invalid', eventId });
    }

  } catch (error) {
    const { message = 'Unknown error', stack } = error;
    console.error({ eventId, message: `orderArchive error: ${message}`, stack });
    callback(error); // function unsuccessful
  }
};
