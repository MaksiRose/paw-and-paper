import { Optional } from 'sequelize';
import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import QuidToServer from './quidToServer';
import ShopRole from './shopRole';

interface QuidToServerToShopRoleAttributes {
	id: number;
	quidToServerId: number;
	shopRoleId: string;
}

type QuidToServerToShopRoleCreationAttributes = Optional<QuidToServerToShopRoleAttributes, 'id'>

@Table
export default class QuidToServerToShopRole extends Model<QuidToServerToShopRoleAttributes, QuidToServerToShopRoleCreationAttributes> {
	@Column({ type: DataType.SMALLINT.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@ForeignKey(() => QuidToServer)
	@Column({ type: DataType.INTEGER })
	declare quidToServerId: number;

	@ForeignKey(() => ShopRole)
	@Column({ type: DataType.STRING })
	declare shopRoleId: string;
}