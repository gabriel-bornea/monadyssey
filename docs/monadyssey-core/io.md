### Introduction to the IO Data Type

In programming, **side effects**—like reading from a database, writing to a file, or making an API call—are 
everywhere. While side effects are essential for most applications, they introduce complexity: they make code harder 
to test, less predictable, and more challenging to reason about. Side effects can happen at unexpected times, or 
their results may vary depending on external systems, making them a common source of bugs and unreliability.

On top of that, managing side effects often intertwines with handling errors. Too often, errors are treated as 
afterthoughts—addressed only when they cause failures. They rarely become part of the domain itself, leading to 
scattered try-catch blocks and inconsistent error management.

The `IO` data type addresses these challenges head-on by encapsulating side effects into a controlled, composable 
abstraction. It enables developers to describe computations—including their potential errors—without executing 
them. This laziness ensures that side effects only occur when explicitly triggered, making workflows more 
predictable, easier to test, and less error-prone.

Moreover, `IO` embeds error handling into its very structure. By representing computations as operations that may 
succeed (`Ok<A>`) or fail (`Err<E>`), it forces developers to acknowledge potential failures upfront, integrating 
errors as a first-class part of the domain. This approach helps avoid surprises in production by encouraging 
thoughtful error management during development.

Most importantly, `IO` is a value. As a value, `IO` is referentially transparent, meaning it behaves predictably 
and consistently, regardless of when or where it is used. This property transforms how developers reason about 
code, enabling them to build maintainable systems and confidently compose complex workflows.

At its core, `IO` is a container for an asynchronous computation that produces a result. This result is either:
* A success (`Ok<A>`), encapsulating the value of type `A`.
* A failure (`Err<E>`), encapsulating an error of type `E`.

Unlike immediately executed functions, `IO` instances are lazy. They describe computations without executing them 
until explicitly triggered (e.g., using the `runAsync` method). This laziness enables `IO` to serve as a "blueprint" 
for assembling workflows, where each operation is deferred until the entire workflow is ready to run.

To better understand how to use `IO` in a real-world scenario, let’s consider an application that displays the 
current weather for a user's location. To achieve this, we’ll:

* Retrieve the user's current latitude and longitude using their IP address.
* Validate the latitude and longitude values.
* Fetch the current weather data based on these coordinates.
* Transform the weather data into a user-friendly format for display.

We’ll use `IO` to manage these operations, encapsulating side effects, ensuring predictable workflows, and handling 
errors consistently.

### Step 1: Retrieve the user's current location

Let’s start with the first step: retrieving the user's current location. This involves making a network request to an 
external service, such as *ipinfo.io*, which provides location information based on the user's IP address.

```typescript
import { IO } from "monadyssey";
import { HttpClient } from "monadyssey-fetch";
import { CurrentLocation } from "./types";
import { UserLocationError, ApplicationError } from "./error";

export const getCurrentLocation = (): IO<ApplicationError, CurrentLocation> =>
  HttpClient
    .get('https://ipinfo.io/json', { credentials: 'omit' })
    .mapError((e) => new UserLocationError(e.message));
```
If we look at the return type, we're not just returning the location—we're also representing the possibility that 
the operation might fail. At first glance, `ApplicationError` might seem a bit generic, and that’s intentional. 
It’s designed to encompass multiple error types, such as `UserLocationError` or `WeatherRetrievalError`, allowing us 
to reason about all possible failure scenarios in a structured and type-safe way:
```typescript
type ApplicationError = UserLocationError | WeatherRetrievalError | InvalidLocationError;
```
This makes errors composable: `ApplicationError` is effectively a **sum type**, meaning it combines multiple distinct 
error cases into a single type.

Another thing you might have noticed is the use of `HttpClient.get` for making the HTTP request to *ipinfo.io*. 
The `HttpClient` is part of the `monadyssey-fetch` package, and it wraps the native fetch API to provide a safer and 
more functional approach to HTTP requests.

Instead of returning a `Promise`, `HttpClient` methods return an `IO` instance. This subtle yet powerful change 
brings several advantages:

* **Deferred Execution**: Like all `IO` operations, the request is described but not executed until explicitly 
triggered. This ensures the operation is referentially transparent, meaning it behaves predictably and consistently 
wherever it’s used.
* **Error Handling**: Any errors encountered during the request are captured and propagated as part of the `IO` 
instance. This allows us to handle errors in a type-safe and structured way, as shown in the `getCurrentLocation` 
function.
* **Functional Composition**: By returning `IO`, the `HttpClient` allows us to chain and compose HTTP requests with 
other `IO` operations, creating seamless workflows without losing control over side effects.

### Step 2: Extracting Latitude and Longitude

Now that we have the user's location, the next step is to extract the latitude and longitude from the `CurrentLocation` 
object. This involves parsing a string (e.g., `"37.7749,-122.4194"`) into a tuple of numbers `[latitude, longitude]`. 
Using `IO`, we can handle this operation safely, ensuring errors are captured and validated.

Here’s how we define the `getLatitudeAndLongitude` function:
```typescript
export const getLatitudeAndLongitude = (location: CurrentLocation): IO<ApplicationError, [number, number]> =>
  IO.ofSync(
    () => location.loc.split(",").map(Number) as [number, number],
    (e) => new InvalidLocationError(e instanceof Error ? e.message : "Failed to parse user location")
  ).refine(
    ([lat, lon]) => !isNaN(lat) && !isNaN(lon),
    () => new InvalidLocationError("Invalid latitude or longitude values")
  );
```
#### Explanation:
- **Parsing the Coordinates**
  * The `IO.ofSync` wraps the synchronous parsing logic.
  * If an error occurs during parsing (e.g., the `loc` string is malformed), it is captured and transformed into an
    `InvalidLocationError`.
```typescript
() => location.loc.split(",").map(Number) as [number, number]
```

- **Error Transformation**
  * The second argument of `IO.ofSync` converts any error into a domain-specific error.
  * This ensures that the error handling remains consistent and type-safe.
```typescript
(e) => new InvalidLocationError(e instanceof Error ? e.message : "Failed to parse user location")
```

- **Validation**
  * After parsing, we validate that both `latitude` and `longitude` are valid numbers.
  * If validation fails, `InvalidLocationError` is returned with a descriptive message.
```typescript
refine(
  ([lat, lon]) => !isNaN(lat) && !isNaN(lon),
  () => new InvalidLocationError("Invalid latitude or longitude values")
)
```

`refine` allows for conditional validation of the result within the `IO`, enabling the
creation of more complex logical flows where the outcome of an operation can be refined or altered
based on dynamic conditions. It is particularly useful for cases where an operation's success needs
to be further qualified by additional criteria not covered by the operation itself.

This step ensures that parsing and validation of critical location data are performed safely and predictably. By 
combining `IO.ofSync` and `refine`, we encapsulate both the operation and its potential failure cases in a single 
composable unit. This approach avoids scattered error handling, ensuring workflows remain structured and maintainable.

### Step 3: Fetching Weather Data

Once we have validated the user's latitude and longitude, the next step is to fetch the current weather data 
for their location. This involves making a network request to an external weather API. Using `IO`, we can 
encapsulate the HTTP request and handle any potential errors in a structured and type-safe way.
```typescript
export const getCurrentWeatherData = (latitude: Number, longitude: Number): IO<ApplicationError, Weather> =>
  HttpClient
    .get(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
      { credentials: 'omit' }
    )
    .mapError(e => new WeatherRetrievalError(e.message));
```
#### Explanation:
- **Making the Request**
  * The `HttpClient.get` method sends a GET request to the Open-Meteo API, including the latitude and longitude 
as query parameters.
  * The API returns a response containing the current weather data, which we aim to encapsulate in the `Weather` type.
```typescript
`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
```
- **Error Handling**
  * Any errors that occur during the HTTP request are captured and transformed into a domain-specific `WeatherRetrievalError`. 
This ensures that the error is meaningful and tied to the operation that caused it.
  * By embedding this error handling directly in the `IO` operation, we make it easier to reason about and handle failures.
```typescript
mapError(e => new WeatherRetrievalError(e.message));
```
- **Composability**
  * The result of this function is an `IO<ApplicationError, Weather>`. This means it can be seamlessly composed with 
other `IO` operations, enabling the creation of complex workflows without losing control over side effects or error 
propagation.

By encapsulating the weather retrieval logic in an `IO`, we:

* Keep the side effect (the HTTP request) deferred until explicitly triggered.
* Handle errors in a structured and type-safe manner, transforming them into domain-specific types like WeatherRetrievalError.
* Maintain a clean separation of concerns, allowing this step to integrate smoothly into a broader workflow.

### Step 4: Transforming Weather Data

With the weather data successfully retrieved, the final step is to transform it into a format suitable for display. 
By combining the user's location with the weather data, we can create a `CurrentConditions` object that contains all 
the necessary details in a user-friendly format.

Since this is a pure transformation function, it has no side effects and doesn't perform any I/O operations. This 
means it is predictable and consistent, always producing the same output for the same inputs. Because of this, we 
don’t need to wrap it inside an `IO`—it’s safe to use as a direct function.

```typescript
export const mapToConditions = (location: CurrentLocation, weather: Weather): CurrentConditions => {
  // Combine location and weather data into a user-friendly format
}
```

### Putting It All Together
With all the steps defined above, combining them into a single workflow is straightforward. The power of `IO` lies in 
its ability to compose operations seamlessly while maintaining predictable behavior and structured error handling. 
Here’s how we implement the complete `getCurrentWeather` function:
```typescript
getCurrentWeather = (): IO<ApplicationError, CurrentConditions> =>
  getCurrentLocation()
    .flatMap((location) =>
      getLatitudeAndLongitude(location)
        .flatMap(([lat, lon]) =>
          getCurrentWeatherData(lat, lon)
            .map((weather) =>
              mapToConditions(location, weather)
            )
        )
    );
```
The function composes the entire workflow by chaining each step—retrieving the user's location, extracting and 
validating coordinates, fetching weather data, and transforming the results into a displayable format—while ensuring 
errors are handled at each stage, side effects remain controlled, and the workflow is executed predictably when triggered.

However, relying on nested `flatMap` calls for composition can affect readability and maintainability. Despite the 
advantages offered by `IO`, many developers might find an `async/await` approach based on `Promises` more intuitive and 
easier to work with in complex workflows.

For this reason, `IO` provides the `forM` function, which abstracts the chaining of nested `flatMap` calls into a more 
readable and maintainable structure. Here's how the same `getCurrentWeather` function can be implemented using `forM`:
```typescript
getCurrentWeather = (): IO<ApplicationError, CurrentConditions> =>
  IO.forM(async (bind) => {
    const location = await bind(getCurrentLocation());
    const [latitude, longitude] = await bind(getLatitudeAndLongitude(location));
    const weather = await bind(getCurrentWeatherData(latitude, longitude));

    return mapToConditions(location, weather);
  });
```
This approach combines the readability of `async/await` with the benefits of `IO`, such as controlled side effects and 
composable error handling. By using `forM`, developers can write workflows in a sequential, imperative style while 
retaining the functional guarantees of `IO`.

The `forM` function lets us sequence multiple `IO` operations using an `async/await` style, making it easier to manage
workflows with dependent steps. Inside `forM`, we use the provided `bind` helper to execute each `IO` operation and 
retrieve its result.

As we mentioned earlier, `IO` operations are lazy. This means that when we call the `getCurrentWeather` function, we 
don’t immediately trigger any of the operations. Instead, we get back a value—an `IO` instance—that encapsulates the 
workflow without executing it:
```typescript
const conditions: IO<ApplicationError, CurrentConditions> = this.getCurrentWeather();
```
At this point, nothing has been executed. The `IO` merely holds a description of the operations to be performed. This 
deferred execution ensures that side effects only occur when explicitly triggered, giving us precise control over when 
and how they are executed.

### Executing the `IO` with `runAsync`
To execute the operations described in an `IO`, we use the `runAsync` method. This method triggers the deferred 
computation and returns a `Promise` that resolves to the result of the operation. The result is wrapped in either:
* `Err<E>`: Representing a failure with an error of type `E`.
* `Ok<A>`: Representing a success with a value of type `A`.

```typescript
const result: Err<ApplicationError> | Ok<CurrentConditions> = await this.getCurrentWeather().runAsync();
```
#### Key points
1. **Controlled execution**: Until `runAsync` is called, the `IO` remains a blueprint and no side effects occur.
2. **Structured result**: Instead of directly resolving to a value or throwing an error, `runAsync` wraps the result 
in `Ok<A>` or `Err<E>`. This ensures that errors are handled in a consistent, type-safe manner.

By always returning a structured result (`Ok<A>` or `Err<E>`), `runAsync` ensures that errors are handled consistently 
across all `IO` operations. This eliminates unexpected exceptions and promotes a unified approach to managing both 
success and failure scenarios. With `runAsync`, we can confidently handle errors as part of their domain logic, making 
our applications more predictable and maintainable.

However, `runAsync` is not the only way to execute an `IO`. Depending on our needs, we can use other methods that 
provide different ways of handling the result:

* `fold`: executes the IO and applies one of two functions based on the outcome:
  * A failure handler (`onFailure`) to transform the error into a value.
  * A success handler (`onSuccess`) to transform the result into a value.
This is particularly useful when we need to normalize the result into a single type.
```typescript
await this.getCurrentWeather().fold(
  (e: ApplicationError) => console.error(e.message),
  (conditions: CurrentConditions) => this.conditions = conditions
);
```
* `getOrNull`: executes the `IO` and returns the result if successful or `null` if it fails. It's helpful when failure 
details are not needed, and the presence of a value is enough.
```typescript
const result: CurrentConditions | null = await this.getCurrentWeather().getOrNull();
```
* `getOrElse`: executes the `IO` and returns the result if successful or a provided default value if it fails. 
The default value can be a constant or a function.
```typescript
const result: CurrentConditions = await this.getCurrentWeather().getOrElse(() => {
  return {
    city: "Bucharest",
    temperature: 23.5
  }
});
```
* `getOrHandle`: executes the `IO` and returns the result if successful or invokes a handler function to handle 
the error and provide an alternative value.
```typescript
const result: CurrentConditions = await this.getCurrentWeather()
  .tapError((e) => console.error(e.message))
  .getOrHandle(() => {
    return {
      city: "Bucharest",
      temperature: 23.5
    }
  });
```
The `IO` data type offers a powerful abstraction for managing side effects, error handling, and composability in a 
predictable and structured way. By encapsulating computations as lazy, referentially transparent operations, `IO` 
ensures **side effects** only occur when explicitly triggered. This approach promotes clean, maintainable code while 
allowing us to handle errors as **first-class citizens** within our domain.
