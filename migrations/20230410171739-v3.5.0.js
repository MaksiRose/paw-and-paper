'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {

		// Add autoproxy_setTo column
		await queryInterface.addColumn('UserToServer', 'autoproxy_setTo', {
			type: Sequelize.SMALLINT,
			allowNull: false,
			defaultValue: 0
		});

		// Set autoproxy_setToWhitelist to false for entries where it is currently null
		await queryInterface.sequelize.query(`
    		UPDATE "UserToServer"
			SET "autoproxy_setTo" = CASE
				WHEN "autoproxy_setToWhitelist" IS NULL THEN 3
				WHEN "stickymode_setTo" = TRUE THEN 2
				ELSE 1
			END,
			"autoproxy_setToWhitelist" = FALSE
			WHERE "autoproxy_setToWhitelist" IS NULL;
    	`);

		// Change autoproxy_setToWhitelist to not allow null
		await queryInterface.changeColumn('UserToServer', 'autoproxy_setToWhitelist', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false
		});
		await queryInterface.removeColumn('UserToServer', 'stickymode_setTo')



		// Add autoproxy_setTo column
		await queryInterface.addColumn('User', 'proxy_setTo', {
			type: Sequelize.SMALLINT,
			allowNull: false,
			defaultValue: 0
		});

		// Set autoproxy_setToWhitelist to false for entries where it is currently null
		await queryInterface.sequelize.query(`
    		UPDATE "User"
			SET "proxy_setTo" = CASE
				WHEN "proxy_globalStickymode" = TRUE THEN 2
				WHEN "proxy_globalAutoproxy" = TRUE THEN 1
				ELSE 0
			END;
    	`);

		// Change autoproxy_setToWhitelist to not allow null
		await queryInterface.removeColumn('User', 'proxy_globalAutoproxy');
		await queryInterface.removeColumn('User', 'proxy_globalStickymode');
	},

	down: async (queryInterface, Sequelize) => {
		
		// Change autoproxy_setToWhitelist to allow null
		await queryInterface.changeColumn('UserToServer', 'autoproxy_setToWhitelist', {
			type: Sequelize.BOOLEAN,
			allowNull: true,
			defaultValue: null
		});

		// Set autoproxy_setToWhitelist to null for entries where setTo is currently null
		await queryInterface.sequelize.query(`
    		UPDATE "UserToServer"
    		SET "autoproxy_setToWhitelist" = null
    		WHERE "autoproxy_setTo" = 3;
    	`)

		await queryInterface.addColumn('UserToServer', 'stickymode_setTo', {
			type: Sequelize.BOOLEAN,
			allowNull: true,
			defaultValue: null
		})

		await queryInterface.sequelize.query(`
    		UPDATE "UserToServer"
    		SET "stickymode_setTo" = TRUE
    		WHERE "autoproxy_setTo" = 2;
    	`)

		// remove autoproxy_setTo column
		await queryInterface.removeColumn('UserToServer', 'autoproxy_setTo')



		// Change autoproxy_setToWhitelist to not allow null
		await queryInterface.addColumn('User', 'proxy_globalAutoproxy', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false
		})
		
		await queryInterface.addColumn('User', 'proxy_globalStickymode', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false
		})

		// Set autoproxy_setToWhitelist to false for entries where it is currently null
		await queryInterface.sequelize.query(`
			UPDATE "User"
			SET 
				"proxy_globalStickymode" = ("proxy_setTo" = 1),
				"proxy_globalAutoproxy" = ("proxy_setTo" = 1 OR "proxy_setTo" = 2)
    	`)

		// Add autoproxy_setTo column
		await queryInterface.removeColumn('User', 'proxy_setTo')
	}
};