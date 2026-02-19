import { Expo } from "expo-server-sdk";

const expo = new Expo();

export const sendPushToAllUsers = async (tokens) => {
  const messages = [];

  for (let pushToken of tokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.log(`Invalid Expo token: ${pushToken}`);
      continue;
    }

    messages.push({
      to: pushToken,
      sound: "default",
      title: "🔥 Evening Reminder",
      body: "You still have calories left today!",
      data: { type: "CALORIE_REMINDER" },
    });
  }

  const chunks = expo.chunkPushNotifications(messages);

  const tickets = [];

  for (let chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error(error);
    }
  }

  return tickets;
};
