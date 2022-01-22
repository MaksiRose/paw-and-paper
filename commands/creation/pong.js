const items = require('../../utils/items');

module.exports = {
	name: 'pong',
	async sendMessage(client, message, argumentsArray, profileData) {

		await items.randomCommonPlant(message, profileData);
	},
};