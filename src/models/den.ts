import { Optional } from 'sequelize';
import { Column, DataType, HasOne, Model, Table } from 'sequelize-typescript';
import Server from './server';

interface DenAttributes {
	id: number;
	structure: number;
	bedding: number;
	thickness: number;
	evenness: number;
}

type DenCreationAttributes = Optional<DenAttributes, 'id' | 'structure' | 'bedding' | 'thickness' | 'evenness'>;

@Table
export default class Den extends Model<DenAttributes, DenCreationAttributes> {
	@Column({ type: DataType.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true })
	declare id: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 100 })
	declare structure: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 100 })
	declare bedding: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 100 })
	declare thickness: number;

	@Column({ type: DataType.SMALLINT.UNSIGNED, defaultValue: 100 })
	declare evenness: number;

	@HasOne(() => Server, { foreignKey: 'sleepingDenId', onDelete: 'SET NULL' })
	declare server_1?: Server;

	@HasOne(() => Server, { foreignKey: 'medicineDenId', onDelete: 'SET NULL' })
	declare server_2?: Server;

	@HasOne(() => Server, { foreignKey: 'foodDenId', onDelete: 'SET NULL' })
	declare server_3?: Server;
}