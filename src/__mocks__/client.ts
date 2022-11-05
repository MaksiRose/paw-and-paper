import { Client } from 'discord.js';
import { mock, instance, when, anyString } from '@johanblumenberg/ts-mockito';

const ClientMock = mock(Client);
when(ClientMock.login(anyString())).thenResolve('');

export const client = instance(ClientMock);