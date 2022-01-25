const fs = require('fs');
const crypto = require('crypto');

module.exports = class Model {

	constructor(path) {

		this.path = path;
	}

	async findOne(filterObject) {

		file_iteration:
		for (const file of fs.readdirSync(this.path)) {

			const dataObject = JSON.parse(fs.readFileSync(`${this.path}/${file}`));

			for (const [key, value] of Object.entries(filterObject)) {

				if (!dataObject[key] || dataObject[key] != value) {

					continue file_iteration;
				}

				return dataObject;
			}
		}

		return null;
	}

	async create(dataObject) {

		let uuid = crypto.randomUUID();
		checkNewUUID();

		dataObject.uuid = uuid;

		fs.writeFileSync(`${this.path}/${uuid}.json`, JSON.stringify(dataObject, null, '\t'));

		return dataObject;


		function checkNewUUID() {

			for (const file of fs.readdirSync(this.path)) {

				if (file == uuid) {

					uuid = crypto.randomUUID();
					return checkNewUUID();
				}
			}

			return;
		}
	}

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

		fs.writeFileSync(`${this.path}/${dataObject.uuid}.json`, JSON.stringify(dataObject, null, '\t'));

		return dataObject;
	}
};