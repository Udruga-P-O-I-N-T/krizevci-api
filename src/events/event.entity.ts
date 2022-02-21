import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
class Organizer {
  @Field({ nullable: true })
  name?: string;
}

@ObjectType()
class Location {
  @Field({ nullable: true })
  name?: string;
}

@ObjectType()
export class Event {
  @Field()
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  startDate?: string;

  @Field({ nullable: true })
  endDate?: string;

  @Field({ nullable: true })
  location?: Location;

  @Field({ nullable: true })
  organizer?: Organizer;

  @Field({ nullable: true })
  url?: string;
}
