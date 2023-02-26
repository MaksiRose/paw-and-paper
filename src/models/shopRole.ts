import { BelongsTo, BelongsToMany, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import QuidToServer from './quidToServer';
import QuidToServerToShopRole from './quidToServerToShopRole';
import Server from './server';

interface ShopRoleAttributes {
	id: string;
	serverId: string;
	wayOfEarning: string;
	requirement: string;
}

@Table
export default class ShopRole extends Model<ShopRoleAttributes, ShopRoleAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => Server)
	@Column({ type: DataType.STRING })
	declare serverId: string;

	@BelongsTo(() => Server, { foreignKey: 'serverId' })
	declare server: Server;

	@Column({ type: DataType.STRING })
	declare wayOfEarning: string;

	@Column({ type: DataType.STRING })
	declare requirement: string;

	@BelongsToMany(() => QuidToServer, () => QuidToServerToShopRole)
	declare quidToServers: QuidToServer[];
}