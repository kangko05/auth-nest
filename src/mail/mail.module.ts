import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

@Module({
    imports: [
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const mailEnabled = configService.get("mail.enabled");
                const enabledTrans = {
                    transport: {
                        host: 'smtp.gmail.com',
                        port: 587,
                        auth: {
                            user: configService.get('mail.user'),
                            pass: configService.get('mail.pass'),
                        },
                    }
                };

                return mailEnabled ? enabledTrans : { transport: { jsonTransport: true } };
            },
        }),
    ],
    providers: [MailService],
    exports: [MailService],
})
export class MailModule { }
