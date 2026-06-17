import { Controller, Get, UseGuards } from "@nestjs/common";
import { User } from "../../users/entities/user.entity";
import { JwtAuthGuard } from "../auth.guard";
import { CurrentUser } from "../decorators/current-user.decorator";

@Controller('internal')
export class InternalHttpController {
    constructor() { }

    @Get('verify')
    @UseGuards(JwtAuthGuard)
    verify(@CurrentUser() user: User) {
        return { verified: true, user: user }
    }
}
