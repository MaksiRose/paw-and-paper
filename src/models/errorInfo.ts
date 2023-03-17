import { Optional } from 'sequelize';
import { Column, DataType, Model, Table } from 'sequelize-typescript';

interface ErrorInfoAttributes {
	id: string;
	stack: string;
	interactionInfo: string;
	isReported: boolean;
	version: string;
}

type ErrorInfoOptionalAttributes = Optional<ErrorInfoAttributes, 'isReported'>

@Table
export default class ErrorInfo extends Model<ErrorInfoAttributes, ErrorInfoOptionalAttributes> {
	@Column({ type: DataType.STRING, primaryKey: true })
	declare id: string;

	@Column({ type: DataType.TEXT })
	declare stack: string;

	@Column({ type: DataType.JSON })
	declare interactionInfo: string;

	@Column({ type: DataType.BOOLEAN, defaultValue: false })
	declare isReported: boolean;

	@Column({ type: DataType.STRING })
	declare version: string;
}