import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '..';
import Server from './server';
import Quid from './quid';
import { CurrentRegionType } from '../typings/data/user';

export default class QuidToServer extends Model<InferAttributes<QuidToServer>, InferCreationAttributes<QuidToServer>> {
	declare id: number;
	declare quidId: string;
	declare serverId: string;
	declare nickname: string;
	declare rank: string;
	declare levels: number;
	declare experience: number;
	declare health: number;
	declare energy: number;
	declare hunger: number;
	declare thirst: number;
	declare maxHealth: number;
	declare maxEnergy: number;
	declare maxHunger: number;
	declare maxThirst: number;
	declare hasQuest: boolean;
	declare unlockedRanks: number;
	declare tutorials_play: boolean;
	declare tutorials_explore: boolean;
	declare currentRegion: string;
	declare sapling_exists: boolean;
	declare sapling_waterCycles: number;
	declare sapling_nextWaterTimestamp: number;
	declare sapling_lastChannelId: string;
	declare sapling_sentReminder: boolean;
	declare sapling_sentGentleReminder: boolean;
	declare injuries_wounds: number;
	declare injuries_infections: number;
	declare injuries_cold: boolean;
	declare injuries_sprains: number;
	declare injuries_poison: boolean;
	declare inventory: string[];
	declare roles: string[];
	declare skills_global: { [key in string]: number };
	declare skills_personal: { [key in string]: number };
	declare lastActiveTimestamp: number;
	declare passedOutTimestamp: number;
}

QuidToServer.init({
	id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
	quidId: { type: DataTypes.STRING, references: { model: Quid, key: 'id' } },
	serverId: { type: DataTypes.STRING, references: { model: Server, key: 'id' } },
	nickname: { type: DataTypes.STRING, defaultValue: '' },
	rank: { type: DataTypes.STRING, defaultValue: '' },
	levels: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 1 },
	experience: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
	health: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 100 },
	energy: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 100 },
	hunger: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 100 },
	thirst: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 100 },
	maxHealth: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 100 },
	maxEnergy: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 100 },
	maxHunger: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 100 },
	maxThirst: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 100 },
	hasQuest: { type: DataTypes.BOOLEAN, defaultValue: false },
	unlockedRanks: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
	tutorials_play: { type: DataTypes.BOOLEAN, defaultValue: false },
	tutorials_explore: { type: DataTypes.BOOLEAN, defaultValue: false },
	currentRegion: { type: DataTypes.STRING, defaultValue: CurrentRegionType.Ruins },
	sapling_exists: { type: DataTypes.BOOLEAN, defaultValue: false },
	sapling_waterCycles: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
	sapling_nextWaterTimestamp: { type: DataTypes.BIGINT, defaultValue: 0 },
	sapling_lastChannelId: { type: DataTypes.STRING, defaultValue: '' },
	sapling_sentReminder: { type: DataTypes.BOOLEAN, defaultValue: false },
	sapling_sentGentleReminder: { type: DataTypes.BOOLEAN, defaultValue: false },
	injuries_wounds: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
	injuries_infections: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
	injuries_cold: { type: DataTypes.BOOLEAN, defaultValue: false },
	injuries_sprains: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
	injuries_poison: { type: DataTypes.BOOLEAN, defaultValue: false },
	inventory: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
	roles: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
	skills_global: { type: DataTypes.JSON },
	skills_personal: { type: DataTypes.JSON },
	lastActiveTimestamp: { type: DataTypes.BIGINT, defaultValue: 0 },
	passedOutTimestamp: { type: DataTypes.BIGINT, defaultValue: 0 },
}, { sequelize });