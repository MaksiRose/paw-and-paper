const fs = require('fs');
const crypto = require('crypto');
const { client } = require('../paw');

class model {
	constructor(path) {

		this.findOne = async function(filterObject) {

			file_iteration: for (const file of fs.readdirSync(path)) {

				if (!file.endsWith('.json')) {

					continue;
				}

				const dataObject = JSON.parse(fs.readFileSync(`${path}/${file}`));

				for (const [key, value] of Object.entries(filterObject)) {

					if (dataObject[key] == undefined || dataObject[key] != value) {

						continue file_iteration;
					}
				}

				return dataObject;
			}

			return null;
		};

		this.find = async function(filterObject) {

			const dataObjectsArray = [];

			file_iteration: for (const file of fs.readdirSync(path)) {

				if (!file.endsWith('.json')) {

					continue;
				}

				const dataObject = JSON.parse(fs.readFileSync(`${path}/${file}`));

				for (const [key, value] of Object.entries(filterObject)) {

					if (dataObject[key] == undefined || dataObject[key] != value) {

						continue file_iteration;
					}
				}

				dataObjectsArray.push(dataObject);
			}

			return dataObjectsArray;
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

		this.findOneAndDelete = async function(filterObject) {

			const dataObject = await this.findOne(filterObject);

			if (!dataObject) {

				return null;
			}

			fs.unlinkSync(`${path}/${dataObject.uuid}.json`);

			console.log('Deleted File: ', dataObject);

			return;
		};

		this.findOneAndUpdate = async function(filterObject, updateObject) {

			const dataObject = await this.findOne(filterObject);

			if (!dataObject) {

				return null;
			}

			const user = (dataObject.userId != undefined) ? await client.users
				.fetch(dataObject.userId)
				.catch((error) => {
					console.error(error);
				}) : null;

			const guild = (dataObject.serverId != undefined) ? await client.guilds
				.fetch(dataObject.serverId)
				.catch((error) => {
					console.error(error);
				}) : null;

			for (const [updateKey, updateValue] of Object.entries(updateObject)) {

				if (updateKey == '$set') {

					for (const [key, value] of Object.entries(updateValue)) {

						if (dataObject[key] != undefined && typeof dataObject[key] == typeof value) {

							(logOutputter(dataObject[key]) != logOutputter(value)) && console.log(`\x1b[32m${(user != null) ? `${user.tag} (${user.id}): ` : ''}\x1b[0m${key} changed from \x1b[33m${logOutputter(objectReducer(dataObject[key], value))} \x1b[0mto \x1b[33m${logOutputter(objectReducer(value, dataObject[key]))} \x1b[0min \x1b[32m${guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

							dataObject[key] = value;
						}
					}
				}

				if (updateKey == '$inc') {

					for (const [key, value] of Object.entries(updateValue)) {

						if (dataObject[key] != undefined && typeof dataObject[key] == typeof value) {

							(value != 0) && console.log(`\x1b[32m${(user != null) ? `${user.tag} (${user.id}): ` : ''}\x1b[0m${key} changed from \x1b[33m${dataObject[key]} \x1b[0mto \x1b[33m${dataObject[key] + value} \x1b[0min \x1b[32m${guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

							dataObject[key] += value;
						}
					}
				}
			}

			fs.writeFileSync(`${path}/${dataObject.uuid}.json`, JSON.stringify(dataObject, null, '\t'));

			return dataObject;

			function logOutputter(variable) {

				if (variable !== Object(variable) || Array.isArray(variable)) {

					return variable;
				}

				let result = JSON.stringify(variable, null, 1);
				result = result.replace(/^ +/gm, ' ');
				result = result.replace(/\n/g, '');
				result = result.replace(/"/g, '');
				result = result.replace(/{ /g, '{').replace(/ }/g, '}');
				result = result.replace(/\[ /g, '[').replace(/ \]/g, ']');
				return result;
			}

			function objectReducer(mainObject, compareObject) {

				if (mainObject !== Object(mainObject) || Array.isArray(mainObject)) {

					return mainObject;
				}

				let newObject = {};

				for (const key in mainObject) {

					if (!Object.prototype.hasOwnProperty.call(compareObject, key)) {

						continue;
					}

					if (mainObject[key] !== Object(mainObject[key]) || Array.isArray(mainObject[key])) {

						if (mainObject[key] != compareObject[key]) {

							newObject[key] = mainObject[key];
						}

						continue;
					}
					else {

						newObject = { ...newObject, ...objectReducer(mainObject[key], compareObject[key]) };
					}
				}

				return newObject;
			}
		};
	}
}

module.exports.model = model;