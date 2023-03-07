import { Sequelize } from 'sequelize-typescript';
import { readdirSync } from 'fs';
import path from 'path';
import Quid from './models/quid';
import User from './models/user';
import DiscordUser from './models/discordUser';
import QuidToServer from './models/quidToServer';
import { Op } from 'sequelize';
import { CurrentRegionType } from './typings/data/user';
const { database_password } = require('../config.json');

const tablePath = path.join(__dirname, './models/');
export const sequelize = new Sequelize('pnp', 'postgres', database_password, {
	host: 'localhost',
	dialect: 'postgres',
	define: {
		freezeTableName: true,
	},
	models: readdirSync(tablePath).map(el => tablePath + el),
	logging: (_msg, sequelizeLogParams: any) => {
		if (
			sequelizeLogParams &&
			sequelizeLogParams.instance &&
			sequelizeLogParams.instance._changed
		) {
			if (sequelizeLogParams.type === 'UPDATE') {
				const changes = (Array.from(sequelizeLogParams.instance._changed) as string[]).map((columnName) => ({
					column: columnName,
					before: sequelizeLogParams.instance._previousDataValues[columnName],
					after: sequelizeLogParams.instance.dataValues[columnName],
				}));
				console.log(`${sequelizeLogParams.instance.constructor.name} ${sequelizeLogParams.instance.id} changed:`, changes);
			}
			else if (sequelizeLogParams.type === 'INSERT') {
				const changes: Record<string, any> = { id: sequelizeLogParams.instance.dataValues.id };
				(Array.from(sequelizeLogParams.instance._changed) as string[]).forEach((columnName) => {
					changes[columnName] = sequelizeLogParams.instance.dataValues[columnName];
				});
				console.log(`Created ${sequelizeLogParams.instance.constructor.name}:`, changes);
			}
		}
	},
});

(async () => {

	await sequelize.sync();

	const quidsToServer = await QuidToServer.findAll({
		include: [{
			model: Quid,
			where: {
				name: { [Op.not]: '' },
				species: { [Op.not]: null },
			},
		}],
	});

	console.log(quidsToServer.length);
})();