import { Resolver, Query } from '@nestjs/graphql';
import { Event } from './event.entity';
import { EventsService } from './events.service';

@Resolver((of) => Event)
export class EventsResolver {
  constructor(private eventsService: EventsService) {}

  // NOTE: [Event] instead of Event[] because that is how GraphQL represents arrays
  @Query((returns) => [Event])
  async events(): Promise<Event[]> {
    return this.eventsService.findAllEvents();
  }
}
