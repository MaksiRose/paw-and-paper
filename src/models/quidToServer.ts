import { BelongsToMany, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { CurrentRegionType } from '../typings/data/user';
import TemporaryStatIncrease from './temporaryStatIncrease';
import ShopRole from './shopRole';
import QuidToServerToShopRole from './quidToServerToShopRole';
import Quid from './quid';
import Server from './server';

@Table
export default class QuidToServer extends Model {
	@Column({ type: DataType.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@ForeignKey(() => Quid)
	@Column({ type: DataType.STRING })
	declare quidId: string;

	@ForeignKey(() => Server)
	@Column({ type: DataType.STRING })
	declare serverId: string;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare nickname: string;

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

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 0 })
	declare sapling_waterCycles: number;

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare sapling_nextWaterTimestamp: number;

	@Column({ type: DataType.STRING, defaultValue: '' })
	declare sapling_lastChannelId: string;

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

	@Column({ type: DataType.JSON })
	declare skills_global: { [key in string]: number };

	@Column({ type: DataType.JSON })
	declare skills_personal: { [key in string]: number };

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare lastActiveTimestamp: number;

	@Column({ type: DataType.BIGINT, defaultValue: 0 })
	declare passedOutTimestamp: number;

	@HasMany(() => TemporaryStatIncrease, { foreignKey: 'quidToServerId' })
	declare temporaryStatIncreases: TemporaryStatIncrease[];

	@BelongsToMany(() => ShopRole, () => QuidToServerToShopRole)
	declare shopRoles: ShopRole[];
}