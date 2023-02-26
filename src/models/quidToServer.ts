import { BelongsToMany, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { CurrentRegionType } from '../typings/data/user';
import TemporaryStatIncrease from './temporaryStatIncrease';
import ShopRole from './shopRole';
import QuidToServerToShopRole from './quidToServerToShopRole';
import Quid from './quid';
import Server from './server';
import { Optional } from 'sequelize';

interface QuidToServerAttributes {
	id: number;
	quidId: string;
	serverId: string;
	rank: string;
	levels: string;
	experience: string;
	health: string;
	energy: string;
	hunger: string;
	thirst: string;
	maxHealth: string;
	maxEnergy: string;
	maxHunger: string;
	maxThirst: string;
	hasQuest: boolean;
	unlockedRanks: number;
	tutorials_play: boolean;
	tutorials_explore: boolean;
	currentRegion: string;
	sapling_exists: boolean;
	sapling_health: number;
	sapling_waterCycles: number;
	sapling_nextWaterTimestamp: number | null;
	sapling_lastChannelId: string | null;
	sapling_sentReminder: boolean;
	sapling_sentGentleReminder: boolean;
	injuries_wounds: number;
	injuries_infections: number;
	injuries_cold: boolean;
	injuries_sprains: number;
	injuries_poison: boolean;
	inventory: string[];
	skills_global: { [key in string]: number };
	skills_personal: { [key in string]: number };
	lastActiveTimestamp: number;
	passedOutTimestamp: number;
}

type QuidToServerOptionalAttributes = Optional<QuidToServerAttributes, 'id' | 'rank' | 'levels' | 'experience' | 'health' | 'energy' | 'hunger' | 'thirst' | 'maxHealth' | 'maxEnergy' | 'maxHunger' | 'maxThirst' | 'hasQuest' | 'unlockedRanks' | 'tutorials_play' | 'tutorials_explore' | 'currentRegion' | 'sapling_exists' | 'sapling_health' | 'sapling_waterCycles' | 'sapling_nextWaterTimestamp' | 'sapling_lastChannelId' | 'sapling_sentReminder' | 'sapling_sentGentleReminder' | 'injuries_wounds' | 'injuries_infections' | 'injuries_cold' | 'injuries_sprains' | 'injuries_poison' | 'inventory' | 'skills_global' | 'skills_personal' | 'passedOutTimestamp'>

@Table
export default class QuidToServer extends Model<QuidToServerAttributes, QuidToServerOptionalAttributes> {
	@Column({ type: DataType.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING })
	declare quidId: string;

	@ForeignKey(() => Server)
	@Column({ type: DataType.STRING })
	declare serverId: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare rank: string;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 1 })
	declare levels: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 0 })
	declare experience: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 100 })
	declare health: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 100 })
	declare energy: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 100 })
	declare hunger: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 100 })
	declare thirst: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 100 })
	declare maxHealth: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 100 })
	declare maxEnergy: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 100 })
	declare maxHunger: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 100 })
	declare maxThirst: number;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare hasQuest: boolean;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 0 })
	declare unlockedRanks: number;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare tutorials_play: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare tutorials_explore: boolean;

	@Column({ type: DataType.STRING, defaultValue: CurrentRegionType.Ruins })
	declare currentRegion: string;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare sapling_exists: boolean;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 50 })
	declare sapling_health: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 0 })
	declare sapling_waterCycles: number;

	@Column({ type: DataType.BIGINT, allowNull: true, defaultValue: null })
	declare sapling_nextWaterTimestamp: number | null;

	@Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
	declare sapling_lastChannelId: string | null;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare sapling_sentReminder: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare sapling_sentGentleReminder: boolean;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 0 })
	declare injuries_wounds: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 0 })
	declare injuries_infections: number;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare injuries_cold: boolean;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 0 })
	declare injuries_sprains: number;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare injuries_poison: boolean;

	@Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: [] })
	declare inventory: string[];

	@Column({ type: DataType.JSON, defaultValue: '{}' })
	declare skills_global: { [key in string]: number };

	@Column({ type: DataType.JSON, defaultValue: '{}' })
	declare skills_personal: { [key in string]: number };

	@Column({ type: DataType.BIGINT })
	declare lastActiveTimestamp: number;

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare passedOutTimestamp: number;

	@HasMany(() => TemporaryStatIncrease, { foreignKey: 'quidToServerId' })
	declare temporaryStatIncreases: TemporaryStatIncrease[];

	@BelongsToMany(() => ShopRole, () => QuidToServerToShopRole)
	declare shopRoles: ShopRole[];
}