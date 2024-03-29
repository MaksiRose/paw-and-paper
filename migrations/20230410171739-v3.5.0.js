'use strict';
const crystalId = require("../node_modules/crystalid");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {

			// Add autoproxy_setTo column
			await queryInterface.addColumn('UserToServer', 'autoproxy_setTo', {
				type: Sequelize.SMALLINT,
				allowNull: false,
				defaultValue: 0
			}).catch(e => console.error(e));

			// Set autoproxy_setToWhitelist to false for entries where it is currently null
			await queryInterface.sequelize.query(`
    		UPDATE "UserToServer"
			SET "autoproxy_setTo" = CASE
				WHEN "autoproxy_setToWhitelist" IS NULL THEN 3
				WHEN "stickymode_setTo" = TRUE THEN 2
				ELSE 1
			END,
			"autoproxy_setToWhitelist" = CASE
				WHEN "autoproxy_setToWhitelist" = TRUE THEN TRUE
				ELSE FALSE
			END;
    		`).catch(e => console.error(e));

			// Change autoproxy_setToWhitelist to not allow null
			await queryInterface.changeColumn('UserToServer', 'autoproxy_setToWhitelist', {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: false
			}).catch(e => console.error(e));
			await queryInterface.removeColumn('UserToServer', 'stickymode_setTo').catch(e => console.error(e))



			// Add autoproxy_setTo column
			await queryInterface.addColumn('User', 'proxy_setTo', {
				type: Sequelize.SMALLINT,
				allowNull: false,
				defaultValue: 0
			}).catch(e => console.error(e));

			// Set autoproxy_setToWhitelist to false for entries where it is currently null
			await queryInterface.sequelize.query(`
    		UPDATE "User"
			SET "proxy_setTo" = CASE
				WHEN "proxy_globalStickymode" = TRUE THEN 2
				WHEN "proxy_globalAutoproxy" = TRUE THEN 1
				ELSE 0
			END;
    	`).catch(e => console.error(e));

			// Change autoproxy_setToWhitelist to not allow null
			await queryInterface.removeColumn('User', 'proxy_globalAutoproxy').catch(e => console.error(e));
			await queryInterface.removeColumn('User', 'proxy_globalStickymode').catch(e => console.error(e));



			await queryInterface.addColumn('Quid', 'proxies', {
				type: Sequelize.ARRAY(Sequelize.ARRAY(Sequelize.STRING)),
				allowNull: false,
				defaultValue: []
			}).catch(e => console.error(e));

			await queryInterface.sequelize.query(`
    		UPDATE "Quid"
			SET "proxies" = "proxies" || ARRAY[ARRAY[
				"proxy_startsWith", "proxy_endsWith"
			]]
			WHERE length("proxy_startsWith") > 0 OR length("proxy_endsWith") > 0
			RETURNING "name", "proxies";
    	`).catch(e => console.error(e));

			await queryInterface.removeColumn('Quid', 'proxy_startsWith').catch(e => console.error(e));
			await queryInterface.removeColumn('Quid', 'proxy_endsWith').catch(e => console.error(e));


			await queryInterface.addColumn('User', 'antiproxies', {
				type: Sequelize.ARRAY(Sequelize.ARRAY(Sequelize.STRING)),
				allowNull: false,
				defaultValue: []
			}).catch(e => console.error(e));

			await queryInterface.sequelize.query(`
    		UPDATE "User"
			SET "antiproxies" = "antiproxies" || ARRAY[ARRAY[
				"antiproxy_startsWith", "antiproxy_endsWith"
			]]
			WHERE length("antiproxy_startsWith") > 0 OR length("antiproxy_endsWith") > 0
			RETURNING "id", "antiproxies";
    	`).catch(e => console.error(e));

			await queryInterface.removeColumn('User', 'antiproxy_startsWith').catch(e => console.error(e));
			await queryInterface.removeColumn('User', 'antiproxy_endsWith').catch(e => console.error(e));



			// add new column with allowNull and default to null
			await queryInterface.addColumn('Server', 'logLimitsId', {
				type: Sequelize.STRING,
				allowNull: true,
				defaultValue: null
			}).catch(e => console.error(e));

			// create a new ProxyLimit record for each Server
			const servers = await queryInterface.sequelize.query(
				'SELECT id FROM "Server";',
				{ type: Sequelize.QueryTypes.SELECT }
			).catch(e => console.error(e));
			const proxyLimits = await Promise.all(servers.map(server => {
				const proxyLimitsId = crystalId.generateId(); // use generateId() function to create custom ID
				return queryInterface.bulkInsert('ProxyLimits', [{
					id: proxyLimitsId,
					createdAt: new Date(),
					updatedAt: new Date()
				}]).then(() => ({ serverId: server.id, proxyLimitsId }))
			})).catch(e => console.error(e));

			// update Servers with the new ProxyLimit records
			await Promise.all(proxyLimits.map(pl =>
				queryInterface.bulkUpdate('Server', { logLimitsId: pl.proxyLimitsId }, { id: pl.serverId })
			)).catch(e => console.error(e));

			// change the column to not allow null and not have a default
			await queryInterface.changeColumn('Server', 'logLimitsId', {
				type: Sequelize.STRING,
				allowNull: false,
				references: {
					model: 'ProxyLimits',
					key: 'id'
				}
			}).catch(e => console.error(e));



			await queryInterface.addColumn('Server', 'logChannelId', {
				type: Sequelize.STRING,
				allowNull: true,
				defaultValue: null
			}).catch(e => console.error(e));

			await queryInterface.addColumn('Server', 'nameRuleSets', {
				type: Sequelize.ARRAY(Sequelize.STRING),
				allowNull: false,
				defaultValue: []
			}).catch(e => console.error(e));

			await queryInterface.addColumn('User', 'proxy_editing', {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: true
			}).catch(e => console.error(e));

			await queryInterface.addColumn('User', 'proxy_keepInMessage', {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: false
			}).catch(e => console.error(e));
		}
		catch (e) {
			console.error(e)
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
	
		// Change autoproxy_setToWhitelist to allow null
		await queryInterface.changeColumn('UserToServer', 'autoproxy_setToWhitelist', {
			type: Sequelize.BOOLEAN,
			allowNull: true,
			defaultValue: null
		}).catch(e => console.error(e));

		// Set autoproxy_setToWhitelist to null for entries where setTo is currently null
		await queryInterface.sequelize.query(`
    		UPDATE "UserToServer"
    		SET "autoproxy_setToWhitelist" = null
    		WHERE "autoproxy_setTo" = 3;
    	`).catch(e => console.error(e))

		await queryInterface.addColumn('UserToServer', 'stickymode_setTo', {
			type: Sequelize.BOOLEAN,
			allowNull: true,
			defaultValue: null
		}).catch(e => console.error(e))

		await queryInterface.sequelize.query(`
    		UPDATE "UserToServer"
    		SET "stickymode_setTo" = TRUE
    		WHERE "autoproxy_setTo" = 2;
    	`).catch(e => console.error(e))

		// remove autoproxy_setTo column
		await queryInterface.removeColumn('UserToServer', 'autoproxy_setTo').catch(e => console.error(e))



		// Change autoproxy_setToWhitelist to not allow null
		await queryInterface.addColumn('User', 'proxy_globalAutoproxy', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false
		}).catch(e => console.error(e))

		await queryInterface.addColumn('User', 'proxy_globalStickymode', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false
		}).catch(e => console.error(e))

		// Set autoproxy_setToWhitelist to false for entries where it is currently null
		await queryInterface.sequelize.query(`
			UPDATE "User"
			SET 
				"proxy_globalStickymode" = ("proxy_setTo" = 1),
				"proxy_globalAutoproxy" = ("proxy_setTo" = 1 OR "proxy_setTo" = 2)
    	`).catch(e => console.error(e))

		// Add autoproxy_setTo column
		await queryInterface.removeColumn('User', 'proxy_setTo').catch(e => console.error(e))



		await queryInterface.addColumn('Quid', 'proxy_startsWith', {
			type: Sequelize.STRING,
			allowNull: false,
			defaultValue: ''
		}).catch(e => console.error(e));
		await queryInterface.addColumn('Quid', 'proxy_endsWith', {
			type: Sequelize.STRING,
			allowNull: false,
			defaultValue: ''
		}).catch(e => console.error(e));

		await queryInterface.sequelize.query(`
    		UPDATE "Quid"
			SET "proxy_startsWith" = "proxies"[1][1], "proxy_endsWith" = "proxies"[1][2]
			WHERE array_length("proxies", 1) > 0
			RETURNING "name", "proxy_startsWith", "proxy_endsWith";
    	`).catch(e => console.error(e));

		await queryInterface.removeColumn('Quid', 'proxies').catch(e => console.error(e));


		await queryInterface.addColumn('User', 'antiproxy_startsWith', {
			type: Sequelize.STRING,
			allowNull: false,
			defaultValue: ''
		}).catch(e => console.error(e));
		await queryInterface.addColumn('User', 'antiproxy_endsWith', {
			type: Sequelize.STRING,
			allowNull: false,
			defaultValue: ''
		}).catch(e => console.error(e));

		await queryInterface.sequelize.query(`
    		UPDATE "User"
			SET "antiproxy_startsWith" = "antiproxies"[1][1], "antiproxy_endsWith" = "antiproxies"[1][2]
			WHERE array_length("antiproxies", 1) > 0
			RETURNING "id", "antiproxy_startsWith", "antiproxy_endsWith";
    	`).catch(e => console.error(e));

		await queryInterface.removeColumn('User', 'antiproxies').catch(e => console.error(e));



			await queryInterface.removeColumn('Server', 'logLimitsId').catch(e => console.error(e));

			await queryInterface.removeColumn('Server', 'logChannelId').catch(e => console.error(e));

			await queryInterface.removeColumn('Server', 'nameRuleSets').catch(e => console.error(e));

			await queryInterface.removeColumn('User', 'proxy_editing').catch(e => console.error(e));

			await queryInterface.removeColumn('User', 'proxy_keepInMessage').catch(e => console.error(e));
		}
		catch (error) { 
			
			console.error(error)
		}
	}
};