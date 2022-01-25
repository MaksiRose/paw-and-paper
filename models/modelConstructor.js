const fs = require('fs');
const crypto = require('crypto');

class model {
	constructor(path) {

		this.findOne = async function(filterObject) {

			file_iteration: for (const file of fs.readdirSync(path)) {

				if (!file.endsWith('.json')) {

					continue;
				}

				const dataObject = JSON.parse(fs.readFileSync(`${path}/${file}`));

				for (const [key, value] of Object.entries(filterObject)) {

					if (!dataObject[key] || dataObject[key] != value) {

						continue file_iteration;
					}

					return dataObject;
				}
			}

			return null;
		};

		this.create = async function(dataObject) {

			let uuid = crypto.randomUUID();
			checkNewUUID();

			dataObject.uuid = uuid;

			fs.writeFileSync(`${path}/${uuid}.json`, JSON.stringify(dataObject, null, '\t'));

			return dataObject;


			function checkNewUUID() {

				for (const file of fs.readdirSync(path)) {

					if (file == uuid) {

						uuid = crypto.randomUUID();
						return checkNewUUID();
					}
				}

				return;
			}
		};

		this.findOneAndUpdate = async function(filterObject, updateObject) {

			const dataObject = await this.findOne(filterObject);

			if (!dataObject) {

				return null;
			}

			for (const [updateKey, updateValue] of Object.entries(updateObject)) {

				if (updateKey == '$set') {

					for (const [key, value] of Object.entries(updateValue)) {

						if (dataObject[key] != undefined && typeof dataObject[key] == typeof value) {

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

			fs.writeFileSync(`${path}/${dataObject.uuid}.json`, JSON.stringify(dataObject, null, '\t'));

			return dataObject;
		};
	}
}

module.exports.model = model;