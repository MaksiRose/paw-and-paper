import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import QuidToServer from './quidToServer';
import ShopRole from './shopRole';

interface QuidToServerToShopRoleAttributes {
	id: string;
	quidToServerId: string;
	shopRoleId: string;
}

@Table
export default class QuidToServerToShopRole extends Model<QuidToServerToShopRoleAttributes, QuidToServerToShopRoleAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@ForeignKey(() => QuidToServer)
	@Column({ type: DataType.STRING })
	declare quidToServerId: string;

	@ForeignKey(() => ShopRole)
	@Column({ type: DataType.STRING })
	declare shopRoleId: string;
}