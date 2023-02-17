import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';
import Den from './den';
import ProxyLimits from './proxyLimits';

export default class Server extends Model<InferAttributes<Server>, InferCreationAttributes<Server>> {
	declare id: string;
	declare name: string;
	declare nextPossibleAttackTimestamp: number;
	declare visitChannelId: string | null;
	declare currentlyVisitingChannelId: string | null;
	declare skills: string[];
	declare proxy_logChannelId: string | null;
	declare proxy_requireTag: boolean;
	declare proxy_requireTagInDisplayname: boolean;
	declare proxy_possibleTags: string[];
	declare proxy_channelLimitsId: number;
	declare proxy_roleLimitsId: number;
	declare inventory: string[];
	declare sleepingDenId: number;
	declare medicineDenId: number;
	declare foodDenId: number;
}

Server.init({
	id: { type: DataTypes.STRING, primaryKey: true },
	name: { type: DataTypes.STRING },
	nextPossibleAttackTimestamp: { type: DataTypes.BIGINT, defaultValue: 0 },
	visitChannelId: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
	currentlyVisitingChannelId: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
	skills: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: ['strength', 'dexterity', 'constitution', 'charisma', 'wisdom', 'intelligence'] },
	proxy_logChannelId: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
	proxy_requireTag: { type: DataTypes.BOOLEAN, defaultValue: false },
	proxy_requireTagInDisplayname: { type: DataTypes.BOOLEAN, defaultValue: false },
	proxy_possibleTags: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
	proxy_channelLimitsId: { type: DataTypes.INTEGER.UNSIGNED, references: { model: ProxyLimits, key: 'id' } },
	proxy_roleLimitsId: { type: DataTypes.INTEGER.UNSIGNED, references: { model: ProxyLimits, key: 'id' } },
	inventory: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
	sleepingDenId: { type: DataTypes.INTEGER.UNSIGNED, references: { model: Den, key: 'id' } },
	medicineDenId: { type: DataTypes.INTEGER.UNSIGNED, references: { model: Den, key: 'id' } },
	foodDenId: { type: DataTypes.INTEGER.UNSIGNED, references: { model: Den, key: 'id' } },
}, { sequelize });