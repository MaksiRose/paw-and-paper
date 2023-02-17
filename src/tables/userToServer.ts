import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';
import Quid from './quid';
import Server from './server';
import User from './user';

export default class UserToServer extends Model<InferAttributes<UserToServer>, InferCreationAttributes<UserToServer>> {
	declare id: number;
	declare userId: string;
	declare serverId: string;
	declare lastProxiedQuidId: string | null;
	declare activeQuidId: string | null;
	declare autoproxy_setToWhitelist: boolean | null;
	declare autoproxy_whitelist: string[];
	declare autoproxy_blacklist: string[];
	declare stickymode_setTo: boolean | null;
	declare tag: string;
	declare lastInteraction_timestamp: number | null;
	declare lastInteraction_channelId: string | null;
	declare resting_messageId: string | null;
	declare resting_channelId: string | null;
	declare componentDisabling_channelId: string | null;
	declare componentDisabling_messageId: string | null;
	declare hasCooldown: boolean;
}

UserToServer.init({
	id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
	userId: { type: DataTypes.STRING, references: { model: User, key: 'id' } },
	serverId: { type: DataTypes.STRING, references: { model: Server, key: 'id' } },
	lastProxiedQuidId: { type: DataTypes.STRING, allowNull: true, defaultValue: null, references: { model: Quid, key: 'id' } },
	activeQuidId: { type: DataTypes.STRING, allowNull: true, defaultValue: null, references: { model: Quid, key: 'id' } },
	autoproxy_setToWhitelist: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: null },
	autoproxy_whitelist: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
	autoproxy_blacklist: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
	stickymode_setTo: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: null },
	tag: { type: DataTypes.STRING, defaultValue: '' },
	lastInteraction_timestamp: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
	lastInteraction_channelId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
	resting_messageId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
	resting_channelId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
	componentDisabling_channelId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
	componentDisabling_messageId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
	hasCooldown: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { sequelize });