import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import QuidToServer from './quidToServer';
import ShopRole from './shopRole';

@Table
export default class QuidToServerToShopRole extends Model {
	@Column({ type: DataType.SMALLINT.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@ForeignKey(() => QuidToServer)
	@Column({ type: DataType.STRING })
	declare quidToServerId: string;

	@ForeignKey(() => ShopRole)
	@Column({ type: DataType.STRING })
	declare shopRoleId: string;
}