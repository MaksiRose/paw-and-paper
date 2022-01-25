const fs = require('fs');
const crypto = require('crypto');

module.exports = {

	async findOne(filterObject) {

		file_iteration:
		for (const file of fs.readdirSync('./database/servers')) {

			const dataObject = JSON.parse(fs.readFileSync(`./database/servers/${file}`));

			for (const [key, value] of Object.entries(filterObject)) {

				if (!dataObject[key] || dataObject[key] != value) {

					continue file_iteration;
				}

				return dataObject;
			}
		}

		return null;
	},

	async create(dataObject) {

		let uuid = crypto.randomUUID();
		checkNewUUID();

		dataObject.uuid = uuid;

		fs.writeFileSync(`./database/servers/${uuid}.json`, JSON.stringify(dataObject, null, '\t'));

		return dataObject;


		function checkNewUUID() {

			for (const file of fs.readdirSync('./database/servers')) {

				if (file == uuid) {

					uuid = crypto.randomUUID();
					return checkNewUUID();
				}
			}

			return;
		}
	},

	async findOneAndUpdate(filterObject, updateObject) {

		const dataObject = module.exports.findOne(filterObject);

		if (!dataObject) {

			return null;
		}

		for (const [updateKey, updateValue] of Object.entries(updateObject)) {

			if (updateKey == '$set') {

				for (const [key, value] of Object.entries(updateValue)) {

					if (dataObject[key] && typeof dataObject[key] == typeof value) {

						dataObject[key] = value;
					}
				}
			}

			if (updateKey == '$inc') {

				for (const [key, value] of Object.entries(updateValue)) {

					if (dataObject[key] && typeof dataObject[key] == typeof value) {

						dataObject[key] += value;
					}
				}
			}
		}

		fs.writeFileSync(`./database/servers/${dataObject.uuid}.json`, JSON.stringify(dataObject, null, '\t'));

		return dataObject;
	},
};