const fs = require('fs');
const profileModel = require('../models/profileModel');

module.exports = {
	execute() {

		for (const file of fs.readdirSync('./database/profiles')) {

			if (!file.endsWith('.json')) {

				continue;
			}

			const dataObject = JSON.parse(fs.readFileSync(`./database/profiles/${file}`));

			if (dataObject.hasCooldown == true) {

				profileModel.findOneAndUpdate(
					{ userId: dataObject.userId, serverId: dataObject.serverId },
					{ $set: { hasCooldown: false } },
				);
			}

			if (dataObject.isResting == true) {

				profileModel.findOneAndUpdate(
					{ userId: dataObject.userId, serverId: dataObject.serverId },
					{ $set: { isResting: false, energy: dataObject.maxEnergy } },
				);
			}
		}
	},
};
