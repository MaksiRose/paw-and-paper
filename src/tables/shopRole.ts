import { BelongsTo, BelongsToMany, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import QuidToServer from './quidToServer';
import QuidToServerToShopRole from './quidToServerToShopRole';
import Server from './server';

@Table
export default class ShopRole extends Model {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: number;

	@ForeignKey(() => Server)
	@Column({ type: DataType.STRING })
	declare serverId: string;

	@BelongsTo(() => Server, { foreignKey: 'serverId' })
	declare server: Server;

	@Column({ type: DataType.STRING })
	declare wayOfEarning: string;

	@Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
	declare requirementNumber: number | null;

	@Column({ type: DataType.STRING, allowNull: true })
	declare requirementRank: string | null;

	@BelongsToMany(() => QuidToServer, () => QuidToServerToShopRole)
	declare quidToServers: QuidToServer[];
}