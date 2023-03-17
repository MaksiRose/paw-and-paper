import { BelongsTo, BelongsToMany, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { CurrentRegionType, RankType } from '../typings/data/user';
import TemporaryStatIncrease from './temporaryStatIncrease';
import ShopRole from './shopRole';
import QuidToServerToShopRole from './quidToServerToShopRole';
import Quid from './quid';
import Server from './server';
import { Optional } from 'sequelize';

interface QuidToServerAttributes {
	id: string;
	quidId: string;
	serverId: string;
	nickname: string;
	rank: RankType;
	levels: number;
	experience: number;
	health: number;
	energy: number;
	hunger: number;
	thirst: number;
	maxHealth: number;
	maxEnergy: number;
	maxHunger: number;
	maxThirst: number;
	hasQuest: boolean;
	unlockedRanks: number;
	tutorials_play: boolean;
	tutorials_explore: boolean;
	currentRegion: CurrentRegionType;
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
	skills_global: string | { [x: string]: number; };
	skills_personal: string | { [x: string]: number; };
	lastActiveTimestamp: number;
	passedOutTimestamp: number;
}

type QuidToServerOptionalAttributes = Optional<QuidToServerAttributes, 'nickname' | 'rank' | 'levels' | 'experience' | 'health' | 'energy' | 'hunger' | 'thirst' | 'maxHealth' | 'maxEnergy' | 'maxHunger' | 'maxThirst' | 'hasQuest' | 'unlockedRanks' | 'tutorials_play' | 'tutorials_explore' | 'currentRegion' | 'sapling_exists' | 'sapling_health' | 'sapling_waterCycles' | 'sapling_nextWaterTimestamp' | 'sapling_lastChannelId' | 'sapling_sentReminder' | 'sapling_sentGentleReminder' | 'injuries_wounds' | 'injuries_infections' | 'injuries_cold' | 'injuries_sprains' | 'injuries_poison' | 'inventory' | 'skills_global' | 'skills_personal' | 'lastActiveTimestamp' | 'passedOutTimestamp'>

@Table
export default class QuidToServer extends Model<QuidToServerAttributes, QuidToServerOptionalAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => Quid<false>)
	@Column({ type: DataType.STRING })
	declare quidId: string;

	// Not sure if this is legal
	@BelongsTo(() => Quid, { foreignKey: 'quidId' })
	declare quid: Quid;

	@ForeignKey(() => Server)
	@Column({ type: DataType.STRING })
	declare serverId: string;

	// Not sure if this works
	@BelongsTo(() => Server, { foreignKey: 'serverId' })
	declare server: Server;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare nickname: string;

	@Column({ type: DataType.STRING, defaultValue: RankType.Youngling })
	declare rank: RankType;

	@Column({ type: DataType.SMALLINT, defaultValue: 1 })
	declare levels: number;

	@Column({ type: DataType.SMALLINT, defaultValue: 0 })
	declare experience: number;

	@Column({ type: DataType.SMALLINT, defaultValue: 100 })
	declare health: number;

	@Column({ type: DataType.SMALLINT, defaultValue: 100 })
	declare energy: number;

	@Column({ type: DataType.SMALLINT, defaultValue: 100 })
	declare hunger: number;

	@Column({ type: DataType.SMALLINT, defaultValue: 100 })
	declare thirst: number;

	@Column({ type: DataType.SMALLINT, defaultValue: 100 })
	declare maxHealth: number;

	@Column({ type: DataType.SMALLINT, defaultValue: 100 })
	declare maxEnergy: number;

	@Column({ type: DataType.SMALLINT, defaultValue: 100 })
	declare maxHunger: number;

	@Column({ type: DataType.SMALLINT, defaultValue: 100 })
	declare maxThirst: number;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare hasQuest: boolean;

	@Column({ type: DataType.SMALLINT, defaultValue: 0 })
	declare unlockedRanks: number;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare tutorials_play: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare tutorials_explore: boolean;

	@Column({ type: DataType.STRING, defaultValue: CurrentRegionType.Ruins })
	declare currentRegion: CurrentRegionType;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare sapling_exists: boolean;

	@Column({ type: DataType.SMALLINT, defaultValue: 50 })
	declare sapling_health: number;

	@Column({ type: DataType.SMALLINT, defaultValue: 0 })
	declare sapling_waterCycles: number;

	@Column({ type: DataType.INTEGER, allowNull: true, defaultValue: null })
	declare sapling_nextWaterTimestamp: number | null;

	@Column({ type: DataType.STRING, allowNull: true, defaultValue: null })
	declare sapling_lastChannelId: string | null;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare sapling_sentReminder: boolean;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare sapling_sentGentleReminder: boolean;

	@Column({ type: DataType.SMALLINT, defaultValue: 0 })
	declare injuries_wounds: number;

	@Column({ type: DataType.SMALLINT, defaultValue: 0 })
	declare injuries_infections: number;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare injuries_cold: boolean;

	@Column({ type: DataType.SMALLINT, defaultValue: 0 })
	declare injuries_sprains: number;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare injuries_poison: boolean;

	@Column({ type: DataType.ARRAY(DataType.STRING), defaultValue: [] })
	declare inventory: string[];

	@Column({ type: DataType.JSON, defaultValue: '{}' })
	declare skills_global: string | { [x: string]: number; };

	@Column({ type: DataType.JSON, defaultValue: '{}' })
	declare skills_personal: string | { [x: string]: number; };

	@Column({ type: DataType.INTEGER, defaultValue: 0 })
	declare lastActiveTimestamp: number;

	@Column({ type: DataType.INTEGER, defaultValue: 0 })
	declare passedOutTimestamp: number;

	@HasMany(() => TemporaryStatIncrease, { foreignKey: 'quidToServerId' })
	declare temporaryStatIncreases: TemporaryStatIncrease[];

	@BelongsToMany(() => ShopRole, () => QuidToServerToShopRole)
	declare shopRoles: ShopRole[];
}