const Firestore = require('@google-cloud/firestore');
const Joi = require('joi');

const PROJECTID = process.env.PROJECTID;
const COLLECTION_NAME = process.env.COLLECTION_NAME;

const orderSchema = Joi.object({
  createdAt: Joi.string().required(),
  id: Joi.string().required(),
  lastModifiedAt: Joi.string().required(),
  order: Joi.object(),
  orderId: Joi.string(),
  resource: Joi.object().required(),
  resourceVersion: Joi.number().required(),
  sequenceNumber: Joi.number().required(),
  type: Joi.string().required(),
  version: Joi.number().required(),
})
  .or('order', 'orderId') // we get an order on create; orderId in other cases
  .unknown(); // allow top level unknown keys

const getValidationError = async (order) => {
  try {
    const value = await orderSchema.validateAsync(order);
    return value.error !== undefined;
  }
  catch (err) {
    return err.message;
  }
}

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
 * @param {function} callback Signals completion of the function's execution.
 */
exports.orderArchive = async (message, context, callback) => {
  const { eventId } = context || {};
  try {
    // 1. extract the order from the pubsub message
    const { data } = message || {};
    const order = JSON.parse(Buffer.from(data, 'base64').toString());

    // 2. validate the order; noop if its invalid
    const validationError = await getValidationError(order);
    if (!validationError) {

      // 3. persist the order to firestore
      const firestore = new Firestore({ projectId: PROJECTID });
      const result = await firestore
        .collection(COLLECTION_NAME)
        .add(order);

      callback(null, 'Success');
      console.log({ message: 'orderArchive success', eventId });
      firestore.terminate();

    } else {
      // function successful but payload was bad
      callback(null, `Order Invalid: ${validationError}`);
      console.log({
        message: `orderArchive invalid: ${validationError}`,
        order: JSON.stringify(order),
        eventId,
      });
    }

  } catch (error) {
    const { message = 'Unknown error', stack } = error;
    console.error({
      eventId,
      message: `orderArchive error: ${message}`,
      stack,
    });
    callback(error); // function unsuccessful
  }
};
