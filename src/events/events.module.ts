import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EventsResolver } from './events.resolver';
import { EventsService } from './events.service';

@Module({
  imports: [HttpModule],
  providers: [EventsService, EventsResolver],
})
export class EventsModule {}
