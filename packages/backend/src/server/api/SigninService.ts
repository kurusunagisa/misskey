import { Inject, Injectable } from '@nestjs/common';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DI } from '@/di-symbols.js';
import type { SigninsRepository, UsersRepository } from '@/models/index.js';
import type { Config } from '@/config.js';
import { IdService } from '@/core/IdService.js';
import type { ILocalUser } from '@/models/entities/User.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { SigninEntityService } from '@/core/entities/SigninEntityService.js';
import { bindThis } from '@/decorators.js';

@Injectable()
export class SigninService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.signinsRepository)
		private signinsRepository: SigninsRepository,

		private signinEntityService: SigninEntityService,
		private idService: IdService,
		private globalEventService: GlobalEventService,
	) {
	}

	@bindThis
	public signin(request: FastifyRequest, reply: FastifyReply, user: ILocalUser, redirect = false) {
		setImmediate(async () => {
			// Append signin history
			const record = await this.signinsRepository.insert({
				id: this.idService.genId(),
				createdAt: new Date(),
				userId: user.id,
				ip: request.ip,
				headers: request.headers,
				success: true,
			}).then(x => this.signinsRepository.findOneByOrFail(x.identifiers[0]));
	
			// Publish signin event
			this.globalEventService.publishMainStream(user.id, 'signin', await this.signinEntityService.pack(record));
		});

		if (redirect) {
			//#region Cookie
			reply.setCookie('igi', user.token!, {
				path: '/',
				// SEE: https://github.com/koajs/koa/issues/974
				// When using a SSL proxy it should be configured to add the "X-Forwarded-Proto: https" header
				secure: this.config.url.startsWith('https'),
				httpOnly: false,
			});
			//#endregion
	
			reply.redirect(this.config.url);
		} else {
			reply.code(200);
			return {
				id: user.id,
				i: user.token,
			};
		}
	}
}

