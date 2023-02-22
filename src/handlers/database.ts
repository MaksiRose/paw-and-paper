import { existsSync, writeFileSync } from 'fs';
import { sequelize } from '..';
// import Den from '../tables/den';
// import DiscordUser from '../tables/discordUser';
// import Friendship from '../tables/friendship';
// import Group from '../tables/group';
// import GroupToQuid from '../tables/groupToQuid';
// import GroupToServer from '../tables/groupToServer';
// import ProxyLimits from '../tables/proxyLimits';
// import Quid from '../tables/quid';
// import QuidToServer from '../tables/quidToServer';
// import QuidToServerToShopRole from '../tables/quidToServerToShopRole';
// import Server from '../tables/server';
// import ServerToDiscordUser from '../tables/serverToDiscordUser';
// import ShopRole from '../tables/shopRole';
// import TemporaryStatIncrease from '../tables/temporaryStatIncrease';
// import User from '../tables/user';
// import UserToServer from '../tables/userToServer';
import { BanList, WebhookMessages, GivenIdList, DeleteList, VoteList } from '../typings/data/general';

export async function execute(
): Promise<void> {

	// Many to many relationship between User and Server through UserToServer
	// User.belongsToMany(Server, { through: UserToServer });
	// Server.belongsToMany(User, { through: UserToServer });

	// One to many relationship between User and Quid
	// User.hasMany(Quid);
	// Quid.belongsTo(User);

	// One to many relationship between Quid 1 and Friendship
	// Quid.hasMany(Friendship, { foreignKey: 'quidId_1' });
	// Friendship.belongsTo(Quid);
	// One to many relationship between Quid 2 and Friendship
	// Quid.hasMany(Friendship, { foreignKey: 'quidId_2' });
	// Friendship.belongsTo(Quid);

	// One to many relationship between User and Group
	// User.hasMany(Group);
	// Group.belongsTo(User);

	// Many to many relationship between Quid and Group through QuidToGroup
	// Group.belongsToMany(Quid, { through: GroupToQuid });
	// Quid.belongsToMany(Group, { through: GroupToQuid });

	// Many to many relationship between Server and Group through QuidToGroup
	// Group.belongsToMany(Server, { through: GroupToServer });
	// Server.belongsToMany(Group, { through: GroupToServer });

	// Many to many relationship between Quid and Server through QuidToGroup
	// Quid.belongsToMany(Server, { through: QuidToServer });
	// Server.belongsToMany(Quid, { through: QuidToServer });

	// One to many relationship between QuidToServer and TemporaryStatIncrease
	// QuidToServer.hasMany(TemporaryStatIncrease);
	// TemporaryStatIncrease.belongsTo(QuidToServer);

	// One to many relationship between User and DiscordUser
	// User.hasMany(DiscordUser);
	// DiscordUser.belongsTo(User);

	// Many to many relationship between Server and DiscordUser
	// Server.belongsToMany(DiscordUser, { through: ServerToDiscordUser });
	// DiscordUser.belongsToMany(Server, { through: ServerToDiscordUser });

	// One to many relationship between Server and ShopRole
	// Server.hasMany(ShopRole);
	// ShopRole.belongsTo(Server);

	// Many to many relationship between QuidToServer and ShopRole
	// QuidToServer.belongsToMany(ShopRole, { through: QuidToServerToShopRole });
	// ShopRole.belongsToMany(QuidToServer, { through: QuidToServerToShopRole });

	// One to one relationship between Server and Den
	// Server.hasOne(Den, { foreignKey: 'sleepingDenId' });
	// Den.belongsTo(Server);
	// Server.hasOne(Den, { foreignKey: 'medicineDenId' });
	// Den.belongsTo(Server);
	// Server.hasOne(Den, { foreignKey: 'foodDenId' });
	// Den.belongsTo(Server);

	// One to one relationship between Server and ProxyLimits
	// Server.hasOne(ProxyLimits, { foreignKey: 'proxy_channelLimitsId' });
	// ProxyLimits.belongsTo(Server);
	// Server.hasOne(ProxyLimits, { foreignKey: 'proxy_roleLimitsId' });
	// ProxyLimits.belongsTo(Server);

	await sequelize.sync({ force: true });


	if (existsSync('./database/bannedList.json') == false) {

		writeFileSync('./database/bannedList.json', JSON.stringify(({ users: [], servers: [] }) as BanList, null, '\t'));
	}

	if (existsSync('./database/errorStacks.json') == false) {

		writeFileSync('./database/errorStacks.json', JSON.stringify(({}) as WebhookMessages, null, '\t'));
	}

	if (existsSync('./database/givenIds.json') == false) {

		writeFileSync('./database/givenIds.json', JSON.stringify(([]) as GivenIdList, null, '\t'));
	}

	if (existsSync('./database/toDeleteList.json') == false) {

		writeFileSync('./database/toDeleteList.json', JSON.stringify(({}) as DeleteList, null, '\t'));
	}

	if (existsSync('./database/voteCache.json') == false) {

		writeFileSync('./database/voteCache.json', JSON.stringify(({}) as VoteList, null, '\t'));
	}

	if (existsSync('./database/webhookCache.json') == false) {

		writeFileSync('./database/webhookCache.json', JSON.stringify(({}) as WebhookMessages, null, '\t'));
	}
}