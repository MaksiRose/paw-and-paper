// @ts-check
const fs = require('fs');
const crypto = require('crypto');
const validTypes = ['undefined', 'boolean', 'number', 'string', 'object', 'array', 'nest', 'any'];

class model {
	/**
	 *
	 * @param {string} path
	 * @param {schema} schema
	 */
	constructor(path, schema) {

		this.path = path;
		this.schema = schema;


		/**
		 * Overwrites a file in the database. **Caution:** This could make unexpected changes to the file!
		 * @param {Object<string, *>} updateObject
		 */
		this.save = async function(updateObject) {

			fs.writeFileSync(`${path}/${updateObject.uuid}.json`, JSON.stringify(updateObject, null, '\t'));
		};

		/**
		 * Searches for an object that meets the filter, and returns it. If several objects meet the requirement, the first that is found is returned.
		 * @param {Object<string, *>} filterObject
		 * @returns {Promise<null | Object.<string, *>>} Data Object or null
		 */
		this.findOne = async function(filterObject) {

			file_iteration: for (const file of fs.readdirSync(path).filter(f => f.endsWith('.json'))) {

				/** @type {Object.<string, *>} */
				const dataObject = JSON.parse(fs.readFileSync(`${path}/${file}`, 'utf-8'));

				for (const [key, value] of Object.entries(filterObject)) {

					if (Object.hasOwn(dataObject, key) === false || dataObject[key] !== value) {

						continue file_iteration;
					}
				}

				return dataObject;
			}

			return null;
		};

		/**
		 * Searches for all objects that meet the filter, and returns an array of them.
		 * @param {(value: any) => boolean} [filter]
		 * @returns {Promise<Array<Object.<string, *>>>} Array of objects
		 */
		this.find = async function(filter) {

			const allDocumentNames = fs.readdirSync(path).filter(f => f.endsWith('.json'));
			const allDocuments = allDocumentNames.map(filename => /** @type {Object.<string, *>} */ (JSON.parse(fs.readFileSync(`${path}/${filename}`, 'utf-8'))));

			return allDocuments.filter((typeof filter === 'function') ? filter : v => v);
		};

		/**
		 * Creates a new database entry.
		 * @param {Object<string, *>} dataObject
		 * @returns {Promise<Object<string, *>>}
		 */
		this.create = async function(dataObject) {

			let uuid = crypto.randomUUID();
			uuid = checkNewUUID();

			dataObject.uuid = uuid;

			/** @type {Object.<string, *>} */
			const updateObject = {};

			for (const [key, { type: type, default: def }] of Object.entries(schema)) {

				// @ts-ignore
				if (Object.hasOwn(dataObject, key) === false) {

					updateObject[key] = (typeof def === type || type === 'any') ? def : [undefined, false, 0, '', {}, [], null][validTypes.indexOf(type[0])];
				}
				else {

					updateObject[key] = dataObject[key];
				}
			}

			this.save(updateObject);

			console.log('Created File: ', updateObject.uuid);

			return dataObject;

			/**
			 * Checks if any file in this path has the uuid as its name, and returns a new uuid if so.
			 * @returns {string} uuid
			 */
			function checkNewUUID() {

				for (const fileName of fs.readdirSync(path).filter(f => f.endsWith('.json'))) {

					if (fileName.includes(uuid)) {

						uuid = crypto.randomUUID();
						return checkNewUUID();
					}
				}

				return uuid;
			}
		};

		/**
		 * Searches for an object that meets the filter, and deletes it. If several objects meet the requirement, the first that is found is deleted.
		 * @param {Object<string, *>} filterObject
		 * @returns {Promise<void>}
		 */
		this.findOneAndDelete = async function(filterObject) {

			const dataObject = await this.findOne(filterObject);

			if (dataObject === null) {

				return;
			}

			fs.unlinkSync(`${path}/${dataObject.uuid}.json`);

			console.log('Deleted File: ', dataObject.uuid);

			return;
		};

		/**
		 * Searches for an object that meets the filter, and updates it. If several objects meet the requirement, the first that is found is updated.
		 * @param {Object<string, *>} filterObject
		 * @param {(value: any) => any} update
		 * @returns {Promise<null | Object<string, *>>}
		 */
		this.findOneAndUpdate = async function(filterObject, update) {

			const dataObject = await this.findOne(filterObject);
			const oldDataObject = JSON.parse(JSON.stringify(dataObject));

			if (dataObject === null) {

				return null;
			}

			update(dataObject);

			logCreator(oldDataObject, dataObject, 'DOC');

			this.save(dataObject);

			return dataObject;


			/**
			 * It takes two objects, compares them, and logs the differences
			 * @param {*} oldVariable - The old variable that was passed in.
			 * @param {*} newVariable - The new variable that is being compared to the old variable.
			 * @param {string} variablePath - The path to the variable in the object.
			 * @returns the value of the variable that is passed to it.
			 */
			function logCreator(oldVariable, newVariable, variablePath) {

				if (newVariable === Object(newVariable)) {

					const testArray = Object.values(newVariable).filter(v => v === Object(v));
					if (testArray.length > 0) {

						for (const key of Object.keys(newVariable)) {

							logCreator(oldVariable?.[key], newVariable[key], variablePath + `.${key}`);
						}
						return;
					}
				}

				if (logOutputter(oldVariable) !== logOutputter(newVariable)) {

					console.log(`\x1b[32m${dataObject?.uuid}: \x1b[0m${variablePath} changed from \x1b[33m${logOutputter(objectReducer(oldVariable, newVariable))} \x1b[0mto \x1b[33m${logOutputter(objectReducer(newVariable, oldVariable))} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
				}
			}

			/**
			 * Formats a variable to be readable for the log output
			 * @param {*} variable
			 * @returns
			 */
			function logOutputter(variable) {

				if (variable !== Object(variable)) {

					return variable;
				}

				if (Array.isArray(variable)) {

					return variable.toString();
				}

				let result = JSON.stringify(variable, null, 1);
				result = result.replace(/^ +/gm, ' ');
				result = result.replace(/\n/g, '');
				result = result.replace(/"/g, '');
				result = result.replace(/{ /g, '{').replace(/ }/g, '}');
				result = result.replace(/\[ /g, '[').replace(/ \]/g, ']');
				return result;
			}

			/**
			 * Compares two objects and returns the difference between them.
			 * @param {*} mainObject
			 * @param {*} compareObject
			 * @returns {*} new Object
			 */
			function objectReducer(mainObject, compareObject) {

				if (mainObject !== Object(mainObject)) {

					return mainObject;
				}

				if (Array.isArray(mainObject)) {

					return '[' + mainObject.join(', ') + ']';
				}

				let newObject = {};

				for (const key in mainObject) {

					if (compareObject !== undefined && !Object.prototype.hasOwnProperty.call(compareObject, key)) {

						continue;
					}

					if (mainObject[key] !== Object(mainObject[key]) || Array.isArray(mainObject[key])) {

						if (mainObject[key] != compareObject?.[key]) {

							newObject[key] = mainObject[key];
						}

						continue;
					}
					else {

						newObject = { ...newObject, ...objectReducer(mainObject[key], compareObject?.[key]) };
					}
				}

				return newObject;
			}
		};

		/**
		 * Updates the information of a file to be accurate to the schema
		 * @param {string} uuid
		 * @returns {Promise<Object.<string, *>>}
		 */
		this.update = async function(uuid) {

			const dataObject = await this.findOne({ uuid: uuid });

			/** @type {Object.<string, *>} */
			const updateObject = transferObjectKeys(dataObject, schema, 'object');

			this.save(updateObject);

			return updateObject;
		};

		/**
		 * Copies a template over to a new object so that keys from an existing object are carried over where possible
		 * @param {*} oldObject
		 * @param {*} schemaObject
		 * @param {string} objectType
		 * @returns {Object.<string, *>}
		 */
		function transferObjectKeys(oldObject, schemaObject, objectType) {

			if (typeof oldObject === 'object' && oldObject !== null) {

				if (objectType === 'object') {

					const newObject = {};

					for (const [key, { type: type, default: def }] of Object.entries(schemaObject)) {

						if (Object.hasOwn(oldObject, key) === false) {

							newObject[key] = transferObjectKeys([def, def, def, def, {}, [], {}, def][validTypes.indexOf(type)], def, type);
						}
						else {

							newObject[key] = transferObjectKeys(oldObject[key], def, type);
						}
					}

					return newObject;
				}
				else if (objectType === 'array') {

					const newArray = [];

					for (const element of oldObject) {

						newArray.push(transferObjectKeys(element, schemaObject.default, schemaObject.type));
					}

					return newArray;
				}
				else if (objectType === 'nest') {

					const newObject = {};

					for (const [key, nestedObject] of Object.entries(oldObject)) {

						newObject[key] = transferObjectKeys(nestedObject, schemaObject.default, schemaObject.type);
					}

					return newObject;
				}
			}

			return oldObject;
		}

		for (const file of fs.readdirSync(path).filter(f => f.endsWith('.json'))) {

			this.update(file.replace('.json', ''));
		}
	}
}

/**
 * Class to create a Schema object
 */
class schema {

	/**
	 * @param {Object<string, {type: string, default?: *, locked?: boolean}>} object
	 */
	constructor(object) {

		for (const [key, value] of Object.entries(makeSchema(object))) {

			this[key] = value;
		}

		/**
		 * @type {{type: string, default: *, locked: boolean}}
		 */
		this.uuid = { type: 'string', default: '', locked: true };
	}
}

/**
 * It takes an object and returns a schema object
 * @param {Object<string, {type: string, default?: *, locked?: boolean}>} object - The object to make a schema from.
 * @returns {Object<string, {type: string, default: *, locked: boolean}>} A schema object.
 */
function makeSchema(object) {

	/** @type {Object<string, {type: string, default: *, locked: boolean}>} */
	const result = {};

	for (const [key, { type: type, default: def, locked: locked }] of Object.entries(object)) {

		let newType = 'any';
		if (validTypes.includes(type)) { newType = type; }
		else if (def !== null) {newType = typeof def; }

		let newDefault = def;
		if (typeof def === 'object' && def !== null) {
			if (newType === 'array' || newType === 'nest') { newDefault = makeSchema({ 0: def })[0]; }
			else { newDefault = makeSchema(def); }
		}
		else if (def === undefined) {
			newDefault = [
				undefined,
				false,
				0,
				'',
				{ type: 'any', default: null, locked: false },
				[{ type: 'any', default: null, locked: false }],
				{ type: 'any', default: null, locked: false },
				null,
			][validTypes.indexOf(newType)];
		}

		result[key] = {
			type: newType,
			default: newDefault,
			locked: Boolean(locked),
		};
	}

	return result;
}

module.exports.model = model;
module.exports.schema = schema;