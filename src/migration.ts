import { Sequelize } from 'sequelize-typescript';
// import { userModel } from './models/userModel';
// import serverModel from './models/serverModel';
import Server from './tables/server';
import path from 'path';
import { readdirSync } from 'fs';
const { database_password } = require('../config.json');

const tablePath = path.join(__dirname, './tables/');
const sequelize = new Sequelize('pnp', 'postgres', database_password, {
	host: 'localhost',
	dialect: 'postgres',
	define: {
		freezeTableName: true,
	},
	models: readdirSync(tablePath).map(el => tablePath + el),
});

(async () => {

	await sequelize.sync({ force: true });

	// const servers = serverModel.find();
	// for (const server of servers) {


	// }

	await Server.create({
	});

	console.log(await Server.findOne());

})();