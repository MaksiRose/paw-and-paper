const fs = require('fs');
const profileModel = require('../../models/profileModel');
const otherProfileModel = require('../../models/otherProfileModel');
const serverModel = require('../../models/serverModel');

module.exports = {
	name: 'ban',
	async sendMessage(client, message, argumentsArray) {

		if (message.author.id != '268402976844939266') {

			return;
		}

		const bannedList = JSON.parse(fs.readFileSync('./database/bannedList.json'));

		const id = argumentsArray.pop();
		const type = argumentsArray.pop();

		if (type === 'user') {

			bannedList.usersArray.push(id);
			fs.writeFileSync('./database/bannedList.json', JSON.stringify(bannedList, null, '\t'));

			const profiles = await profileModel.find({ userId: id });
			const otherProfiles = await otherProfileModel.find({ userId: id });

			for (const profile of profiles) {

				await profileModel.findOneAndDelete({ userId: profile.userId, serverId: profile.serverId });
			}

			for (const profile of otherProfiles) {

				await otherProfileModel.findOneAndDelete({ userId: profile.userId, serverId: profile.serverId });
			}

			if (profiles.length > 0 || otherProfiles.length > 0) {

				const user = await client.users.fetch(id);

				await user
					.createDM()
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				await user
					.send({ content: 'I am sorry to inform you that you have been banned from using this bot.' })
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}
		}

		if (type === 'server' || type === 'guild') {

			bannedList.serversArray.push(id);
			fs.writeFileSync('./database/bannedList.json', JSON.stringify(bannedList, null, '\t'));

			const server = await serverModel.find({ serverId: id });
			const profiles = await profileModel.find({ serverId: id });
			const otherProfiles = await otherProfileModel.find({ serverId: id });

			await serverModel.findOneAndDelete({ serverId: id });

			for (const profile of profiles) {

				await profileModel.findOneAndDelete({ userId: profile.userId, serverId: profile.serverId });
			}

			for (const profile of otherProfiles) {

				await otherProfileModel.findOneAndDelete({ userId: profile.userId, serverId: profile.serverId });
			}

			if (server !== null) {

				const guild = await client.guilds.fetch(id);
				const user = await client.users.fetch(guild.ownerId);

				await user
					.createDM()
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				await user
					.send({ content: `I am sorry to inform you that your guild \`${guild.name}\` has been banned from using this bot.` })
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				await guild
					.leave()
					.catch((error) => {
						throw new Error(error);
					});
			}
		}
	},
};