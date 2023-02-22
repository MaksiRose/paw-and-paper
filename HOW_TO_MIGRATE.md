1. Run npx sequelize-cli migration:generate --name migration-skeleton

2. Edit the file to reflect the wanted changes
Here is an example of how it would look if you wanted to add a "isWhitelisted" column to the "Server" table:
```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Server', 'isWhitelisted', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Server', 'isWhitelisted');
  }
};
```

3. Edit the actual models to reflect the wanted changes as well

4. Run npx sequelize-cli db:migrate

5. To undo, run npx sequelize-cli db:migrate:undo  and delete the changes from the models